const	flikrDS			= require('./connectors/mysql').connection,
		flickrObject	= require("./models/flickr").flickrModel,
		flickrModel		= new flickrObject(flikrDS),
		apiClass		= require('./components/api').api;

let api;

async function processCollections(api) {
	const	collections = await flickrModel.getCollections();

	return Promise.all(collections.map(async collection => {
		process.stdout.write(`\n************* COLLECTION ID: ${collection.id} ************\n`);

		let collectionAlbums = await api.getCollectionAlbums(collection.id);

		await processAlbums(collectionAlbums.set, collection.id);
	}));
}

// Check if Flickr Albums are in DB and vice versa
async function processAlbums(albumbsFromFlikr, collectionId) {
	let	albumIdsFromFlickr = [],
		albumbsFromFlikrById = {},
		albumbsFromDBById = {},
		album;

	// Turn albums from Flicker API call into an array and object of Flickr albums
	[albumIdsFromFlickr, albumbsFromFlikrById] = getAlbumnByIdObjects(albumbsFromFlikr);

	// Usint the Flickr API album ids, search for the same albumbs in the DB and get an object of DB albums by album id
	albumbsFromDBById = await getDatabaseAlbumsById(albumIdsFromFlickr, albumbsFromFlikrById);

	// Send the albums found at Flick and in DB, and create missing ones and update existing
	await CheckAndCreateMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId);

	for(let albumId in albumbsFromDBById) {
		album = await api.getAlbumPhotos(albumId);
		await processPhotos(album.set, albumId)
	}

	return true;
}

// Return an array and object by id to access Flick album data
function getAlbumnByIdObjects(albumbsFromFlikr) {
	let	albumIdsFromFlickr = [],
		albumbsFromFlikrById = {};

	process.stdout.write("\n\n********** Flickr Albums **********\n")
	albumbsFromFlikr.map(album => {
		albumIdsFromFlickr.push(album.id)

		process.stdout.write(album.title + "\n" + (album.description.length ? "* " + album.description + "\n" : "\n"));

		// Popuplate a new object that uses the album id as a key
		albumbsFromFlikrById[album.id] = {
			title		: album.title,
			description	: album.description
		}
	});
	process.stdout.write("\n********** /Flickr Albums **********\n\n")

	return [albumIdsFromFlickr, albumbsFromFlikrById];
}

// Retrieve the albums from the DB, based on the album ids retrieved from Flickr
async function getDatabaseAlbumsById(albumIdsFromFlickr, albumbsFromFlikrById) {
	let albumbsFromDBById = {};
	const albumsInDB = await flickrModel.getAlbumInfo(albumIdsFromFlickr); // Pass Flickr album ids to db to find existing albums

	//Loop through albums in local database and find any that don't exist from flickr api
	process.stdout.write("\n\n********** DB Albums **********\n");
	albumsInDB.map(album => {
		let atFlickr = true; // assume album is at flickr, unless found not to be below

		if(!albumbsFromFlikrById.hasOwnProperty(album.id)) {
			// Album in Database doesn't exist at flickr
			process.stdout.write("\nWARNING: Missing album at Flickr that is in the DB (probably need to delete from or fix database) : \n");
			process.stdout.write(album);
			atFlickr = false;
		}

		process.stdout.write("\n" + album.title + "\n" + (album.description.length ? "* " + album.description + "\n" : ""));

		// Create an object of albums in DB
		albumbsFromDBById[album.id] = {
			title		: album.title,
			description	: album.description,
			atFlickr
		}
	});
	process.stdout.write("\n********** /DB Albums **********\n\n")

	return albumbsFromDBById;
}

// Check for albums retrieved from Flikr that are not stored in the DB and create or update existing ones
async function CheckAndCreateMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId) {
	let createdAlbumStatus;

	process.stdout.write("\n\n********** Missing DB Album Check and Insert **********\n")
	for(let albumFromFlickrId in albumbsFromFlikrById) {
		if(!albumbsFromDBById.hasOwnProperty(albumFromFlickrId)) {
			// Flickr Album doesn't exist in DB, so insert it

			process.stdout.write("\nAlbum from Flickr is Missing from the DB. Creating....\n");
			process.stdout.write(albumFromFlickrId + "\n");
			process.stdout.write(albumbsFromFlikrById[albumFromFlickrId]);

			// TODO: perform a multi-insert
			createdAlbumStatus = await flickrModel.saveAlbum(
				albumFromFlickrId,
				collectionId,
				albumbsFromFlikrById[albumFromFlickrId].title,
				albumbsFromFlikrById[albumFromFlickrId].description);


			if(!createdAlbumStatus.failed) {
				process.stdout.write(createdAlbumStatus)
				process.stdout.write(`\nAlbum ***${albumbsFromFlikrById[albumFromFlickrId].title}*** `);

				if(!createdAlbumStatus.affectedRows) {
					process.stdout.write("NOT ");
				}

				process.stdout.write("inserted into DB\n\n");
			} else {
				process.stdout.write(`\n\nFailed Creating Album ***${albumbsFromFlikrById[albumFromFlickrId].title}***\n`);
				process.stdout.write(createdAlbumStatus.reason);
			}
		} else {
			// Flickr Album exists in the DB, so update it
			process.stdout.write(`\n\nUpdating existing Album: (${albumFromFlickrId}) ${albumbsFromFlikrById[albumFromFlickrId].title}\n`);

			updateAlbumStatus = await flickrModel.updateAlbum(
					albumFromFlickrId,
					albumbsFromFlikrById[albumFromFlickrId].title,
					albumbsFromFlikrById[albumFromFlickrId].description
			);

			process.stdout.write("\nRow Found: " + (updateAlbumStatus.affectedRows ? true : false));
			process.stdout.write("\nRow Updated: " + (updateAlbumStatus.changedRows ? true : false) + "\n");
		}
	}
	process.stdout.write("\n********** /Missing DB Album Check and Insert **********\n\n")

	return;
}

async function processPhotos(flickrPhotos, albumId) {
	let photoValues = [], // hold an array of sql insert values
		result,
		flickrPhotosById = {},
		dbPhotosById = {},
		albumPhotos;

	// Create an array of insert values for a multi-insert sql operatiom
	flickrPhotos.photo.map((flickrPhoto, index) => {
		if(flickrPhoto.ispublic) {
			photoValues.push([
				flickrPhoto.id,
				albumId,
				index,
				flickrPhoto.title,
				flickrPhoto.description._content,
				flickrPhoto.url_sq,
				flickrPhoto.height_sq,
				flickrPhoto.width_sq,
				flickrPhoto.url_s,
				flickrPhoto.height_s,
				flickrPhoto.width_s,
				flickrPhoto.url_m,
				flickrPhoto.height_m,
				flickrPhoto.width_m,
				flickrPhoto.datetaken]);

			flickrPhotosById[flickrPhoto.id] = {
				title		: flickrPhoto.title,
				description	: flickrPhoto.description
			};
		}
	});

	if(photoValues.length) {
		// Attempt to bulk insert photos
		result = await flickrModel.savePhotos(photoValues);

		if(result.failed) {
			if(result.errno === 1062) {
				// Photo already exists. If different title then update

				// Retrieve DB photos and match with Flickr photo ids and title for updating
				dbPhotos = await flickrModel.getAlbumPhotos(albumId);

				dbPhotos.map(dbPhoto => {
					//assign to an Object to compare titles
					dbPhotosById[dbPhoto.id] = {
						title		: dbPhoto.title,
						description	: dbPhoto.description
					};
				});

				// Check if Flickr title/description changed and update in DB
				for(let id in flickrPhotosById) {
					if(	dbPhotosById.hasOwnProperty(id) &&
						(	dbPhotosById[id].title !== flickrPhotosById[id].title
							||
							dbPhotosById[id].description !== flickrPhotosById[id].description._content
						 )
						) {
							// Update database with new title
							process.stdout.write(`Update Description: ${dbPhotosById[id].description} !== ${flickrPhotosById[id].description._content}\n`);
							photoUpdatedStatus = await flickrModel.updatePhoto(id, flickrPhotosById[id].title, flickrPhotosById[id].description._content);

							process.stdout.write("Row Found: " + (photoUpdatedStatus.affectedRows ? true : false));
							process.stdout.write("\nRow Updated: " + (photoUpdatedStatus.changedRows ? true : false) + "\n");
						}
				}
			}
		} else {
			process.stdout.write(`\nSUCCESS: Inserted ${result.affectedRows} photos\n`);

			result = await flickrModel.savePhotoURLS();

			if(result.failed) {
				process.stdout.write(result.reason);
			} else {
				process.stdout.write(`\nSUCCESS: Created ${result.affectedRows} photo Title URLS\n`);
			}
		}
	} else {
		process.stdout.write("\nNo albums found to insert\n");
	}

	return true;
}

let myPromise = new Promise(async (resolve, reject) => {
	let processedCollections;

	api = await new apiClass(flickrModel)

	processedCollections = await processCollections(api);

	resolve("Finished Processing Collections!\n")
});

myPromise.then((message) => {
	process.stdout.write(message);
	process.stdout.write("Closing DB connection...");

	flikrDS.end(err => {
		if(err) {
			console.log("***********Error Closing DB connection*********");
			console.error(err);
			return;
		}
		process.stdout.write("closed!\n");
	});

});