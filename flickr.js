const	flikrDS			= require('./connectors/mysql').connection,
		flickrObject	= require("./models/flickr").flickrModel,
		flickrModel		= new flickrObject(flikrDS),
		https			= require("https");

let		api	=	{
			key		: null,
			secret	: null,
			userId	: null
		};

async function setAPICreds() {
	const apiCreds		= await flickrModel.getCredentials();

	apiCreds.map(cred => {
		switch(cred.name) {
			case "flickrAPIKey":
				api.key = cred.value;
			break;
			case "flikrAPISecret":
				api.secret = cred.value;
			break;
			case "flickrUserId":
				api.userId = cred.value;
			break;
		}
	});
}

async function processCollections(api) {
	const	collections = await flickrModel.getCollections();

	await collections.map(async (collection, index) => {
		process.stdout.write(`\n************* COLLECTION ID: ${collection.id} ************\n`);
		process.stdout.write("collections index = ", index)
		await getAPICollections(collection.id);
	});
}

function getAPICollections(collectionId) {
	return new Promise((resolve, reject) => {
		https.get(`https://api.flickr.com/services/rest/?method=flickr.collections.getTree&api_key=${api.key}&collection_id=${collectionId}&user_id=${api.userId}&format=json&nojsoncallback=1`,
			res => {
				var body = "";

				res.on("data", data => {
					body += data;
				});

				res.on("end", () => {
					if(res.statusCode === 200) {
						try {
							let jsonResponse = JSON.parse(body);

							if(!jsonResponse.stat || jsonResponse.stat !== "ok" ||
								!jsonResponse.collections || !jsonResponse.collections.collection ||
								!jsonResponse.collections.collection[0] || !jsonResponse.collections.collection[0].set)
								throw new Error("Error parsing JSON");

							process.stdout.write(`************* COLLECTION TITLE: ${jsonResponse.collections.collection[0].title} ************\n`);
							resolve({
										process : processAlbums(jsonResponse.collections.collection[0].set, collectionId),
										success	: true});
						} catch(e) {

							process.stdout.write(`Error parsing JSON from getAPICollections(${collectionId})`);
							process.stdout.write(e)
							reject(e)
						}
					} else {
						throw new Error(`Bad response code in getAPICollections(${collectionId})`);
					}
				});
		}).on('error', (e) => {
			process.stdout.write(`\ngetAPICollections(${collectionId}) API response error\n`);
			console.error(e);

			reject(e);
		});
	}).catch(err => {
		process.stdout.write(`\ngetAPICollections(${collectionId}) Promise Error\n`);
		process.stdout.write(err);
	});
}

// Check if Flickr Albums are in DB and vice versa
async function processAlbums(albumbsFromFlikr, collectionId) {
	let	albumIdsFromFlickr = [],
		albumbsFromFlikrById = {},
		albumbsFromDBById = {},
		status;

	// Turn albums from Flicker API call into an array and object of Flickr albums
	[albumIdsFromFlickr, albumbsFromFlikrById] = await getAlbumnsByIdObjects(albumbsFromFlikr);

	// Usint the Flickr API album ids, search for the same albumbs in the DB and get an object of DB albums by album id
	albumbsFromDBById = await getDatabaseAlbumsById(albumIdsFromFlickr, albumbsFromFlikrById);

	// Send the albums found at Flick and in DB, and create missing ones and update existing
	await CheckAndCreateMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId);

	for(let albumId in albumbsFromDBById) {
		status = await getAlbumPhotos(albumId);
	}

	return await status;
}

// Return an array and object by id to access Flick album data
function getAlbumnsByIdObjects(albumbsFromFlikr) {
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

async function getAlbumPhotos(albumId) {

	process.stdout.write(`\n\n********** API get Album photos for ${albumId} **********\n`);

	return new Promise((resolve, reject) => {
		https.get(`https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${api.key}&photoset_id=${albumId}&extras=description,date_taken,url_sq,url_s,url_m,url_o,geo,tags&privacy_filter=1&user_id=${api.userId}&per_page=100&format=json&nojsoncallback=1`,
				(res) => {
					var body = '';

					res.on('data', function(chunk){
						body += chunk;
					});

					res.on("end", () => {
						if(res.statusCode === 200) {
							try {
								const jsonResponse = JSON.parse(body);

								if(!jsonResponse.stat || jsonResponse.stat !== "ok" || !jsonResponse.photoset) {
									throw new Error("jsonResponse bad");
								}

								resolve({
									process : processPhotos(jsonResponse.photoset, albumId),
									success	: true});
							} catch(e) {
								process.stdout.write(`\nError parsing JSON from getPhotoAlbums(${albumId})\n`);
								process.stdout.write(e)
							}
						} else {
							process.stdout.write(`\ngetPhotoAlbums(${albumId}) bad status code (${res.statusCode})\n`);
						}
					});
				}).on('error', (e) => {
					process.stdout.write(`\ngetPhotoAlbums(${albumId}) API response error\n`);
					console.error(e);

					reject(e);
				});
	}).catch(err => {
		process.stdout.write(`\ngetPhotoAlbums(${albumId}) Promise Error\n`);
		process.stdout.write(err);
	});
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

setAPICreds();
//processCollections(api);

let myPromise = new Promise(async (resolve, reject) => {
	await processCollections(api);
	resolve("success")
})

myPromise.then((message) => {
	process.stdout.write(message)
})

//flikrDS.end();
