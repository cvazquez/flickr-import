const	flikrDS			= require('./connectors/mysql'),
		dbConnection	= flikrDS.connection,
		flickrClass		= require("./models/flickr").flickrModel,
		flickrModel		= new flickrClass(dbConnection),
		apiClass		= require('./components/api').api;

let api,
	forcePhotoUpdate = process.argv.indexOf("force-photo-update") > -1 ? true : false,
	myPromise,
	userName;

	for(let argv in process.argv) {
		if(/^userName=/.test(process.argv[argv])) {
			userName = process.argv[argv].split("=")[1];
		}
	}

	myPromise = new Promise(async (resolve, reject) => {
		let processedCollections;

		api = await new apiClass(flickrModel);

		processedCollections = await processCollections(api);

		resolve("Finished Processing Collections!\n");
	});

myPromise.then((message) => {
	process.stdout.write(message);
	flikrDS.close(dbConnection);
});

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
		album = await api.getAlbumPhotosOAuth(albumId, userName, flickrModel);
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
	let flickrPhotoValues = [], // hold an array of sql insert values
		result,
		flickrPhotosById = {},
		dbPhotosById = {};

	// Create an array of insert values for a multi-insert sql operatiom
	flickrPhotos.photo.map((flickrPhoto, index) => {
		if(flickrPhoto.ispublic) {
			flickrPhotoValues.push([
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
				flickrPhoto.url_o,
				flickrPhoto.height_o,
				flickrPhoto.width_o,
				flickrPhoto.datetaken]);

			flickrPhotosById[flickrPhoto.id] = {
				title		: flickrPhoto.title,
				description	: flickrPhoto.description,
				url_sq		: flickrPhoto.url_sq,
				height_sq	: flickrPhoto.height_sq,
				width_sq	: flickrPhoto.width_sq,
				url_s		: flickrPhoto.url_s,
				height_s	: flickrPhoto.height_s,
				width_s		: flickrPhoto.width_s,
				url_m		: flickrPhoto.url_m,
				height_m	: flickrPhoto.height_m,
				width_m		: flickrPhoto.width_m,
				url_o		: flickrPhoto.url_o,
				height_o	: flickrPhoto.height_o,
				width_o		: flickrPhoto.width_o
			};
		}
	});


	if(flickrPhotoValues.length) {
		// Attempt to bulk insert photos
		result = await flickrModel.savePhotos(flickrPhotoValues);

		if(result.failed ||	forcePhotoUpdate) {
			if(result.errno === 1062 ||	forcePhotoUpdate) {
				// Photo already exists. If different title then update

				// Retrieve DB photos and match with Flickr photo ids and title for updating
				dbPhotos = await flickrModel.getAlbumPhotos(albumId);

				dbPhotos.map(dbPhoto => {
					//assign to an Object to compare titles
					dbPhotosById[dbPhoto.id] = {
						title		: dbPhoto.title,
						description	: dbPhoto.description,
						squareURL	: dbPhoto.squareURL,
						squareWidth	: dbPhoto.squareWidth,
						squareHeight: dbPhoto.squareHeight,
						smallURL	: dbPhoto.smallURL,
						smallWidth	: dbPhoto.smallWidth,
						smallHeight	: dbPhoto.smallHeight,
						mediumURL	: dbPhoto.mediumURL,
						mediumWidth	: dbPhoto.mediumWidth,
						mediumHeight: dbPhoto.mediumHeight,
						largeURL	: dbPhoto.largeURL,
						largeWidth	: dbPhoto.largeWidth,
						largeHeight	: dbPhoto.largeHeight
					};
				});

				// Check if Flickr title/description changed and update in DB
				for(let id in flickrPhotosById) {
					if(	dbPhotosById.hasOwnProperty(id) &&
						(	dbPhotosById[id].title !== flickrPhotosById[id].title
							||
							dbPhotosById[id].description !== flickrPhotosById[id].description._content
							||
							forcePhotoUpdate
						 )
						) {
							// Refresh photos in DB with Flickr data
							console.log('Updating: ' + flickrPhotosById[id].title);
							photoUpdatedStatus = await flickrModel.updatePhoto(
																id,
																flickrPhotosById[id].title,
																flickrPhotosById[id].description._content,
																flickrPhotosById[id].url_sq,
																flickrPhotosById[id].height_sq,
																flickrPhotosById[id].width_sq,
																flickrPhotosById[id].url_s,
																flickrPhotosById[id].height_s,
																flickrPhotosById[id].width_s,
																flickrPhotosById[id].url_m,
																flickrPhotosById[id].height_m,
																flickrPhotosById[id].width_m,
																flickrPhotosById[id].url_o,
																flickrPhotosById[id].height_o,
																flickrPhotosById[id].width_o
															);

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