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
		console.log(`************* COLLECTION ID: ${collection.id} ************`);
		var status = await getAPICollections(collection.id);
		console.log(status);
		console.log("collections index = ", index)
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

							console.log(`************* COLLECTION TITLE: ${jsonResponse.collections.collection[0].title} ************\n`);
							resolve({
										process : processAlbums(jsonResponse.collections.collection[0].set, collectionId),
										success	: true});
						} catch(e) {

							console.log(`Error parsing JSON from getAPICollections(${collectionId})`);
							console.log(e)
							reject(e)
						}
					} else {
						throw new Error(`Bad response code in getAPICollections(${collectionId})`);
					}
				});
		}).on('error', (e) => {
			console.log(`getAPICollections(${collectionId}) API response error`);
			console.error(e);

			reject(e);
		});
	}).catch(err => {
		console.log(`getAPICollections(${collectionId}) Promise Error`);
		console.log(err);
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

	console.log("********** Flickr Albums **********")
	albumbsFromFlikr.map(album => {
		albumIdsFromFlickr.push(album.id)

		console.log(album.title + "\n" + (album.description.length ? "* " + album.description + "\n" : ""));

		// Popuplate a new object that uses the album id as a key
		albumbsFromFlikrById[album.id] = {
			title		: album.title,
			description	: album.description
		}
	});
	console.log("********** /Flickr Albums **********\n\n")

	return [albumIdsFromFlickr, albumbsFromFlikrById];
}

// Retrieve the albums from the DB, based on the album ids retrieved from Flickr
async function getDatabaseAlbumsById(albumIdsFromFlickr, albumbsFromFlikrById) {
	let albumbsFromDBById = {};
	const albumsInDB = await flickrModel.getAlbumInfo(albumIdsFromFlickr); // Pass Flickr album ids to db to find existing albums

	//Loop through albums in local database and find any that don't exist from flickr api
	console.log("********** DB Albums **********")
	albumsInDB.map(album => {
		let atFlickr = true; // assume album is at flickr, unless found not to be below

		if(!albumbsFromFlikrById.hasOwnProperty(album.id)) {
			// Album in Database doesn't exist at flickr
			console.log("WARNING: Missing album at Flickr that is in the DB (probably need to delete from or fix database) : ");
			console.log(album);
			atFlickr = false;
		}

		console.log(album.title + "\n" + (album.description.length ? "* " + album.description + "\n" : ""));

		// Create an object of albums in DB
		albumbsFromDBById[album.id] = {
			title		: album.title,
			description	: album.description,
			atFlickr
		}
	});
	console.log("********** /DB Albums **********\n\n")

	return albumbsFromDBById;
}

// Check for albums retrieved from Flikr that are not stored in the DB and create or update existing ones
async function CheckAndCreateMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId) {
	let createdAlbumStatus;

	console.log("********** Missing DB Album Check and Insert **********")
	for(let albumFromFlickrId in albumbsFromFlikrById) {
		if(!albumbsFromDBById.hasOwnProperty(albumFromFlickrId)) {
			// Flickr Album doesn't exist in DB, so insert it

			console.log("Album from Flickr is Missing from the DB. Creating....");
			console.log(albumFromFlickrId)
			console.log(albumbsFromFlikrById[albumFromFlickrId]);

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
				console.log(`Failed Creating Album ***${albumbsFromFlikrById[albumFromFlickrId].title}***`);
				console.log(createdAlbumStatus.reason);
			}
		} else {
			// Flickr Album exists in the DB, so update it
			console.log(`Updating existing Album: (%s) %s `,albumFromFlickrId, albumbsFromFlikrById[albumFromFlickrId].title)
			updateAlbumStatus = await flickrModel.updateAlbum(
					albumFromFlickrId,
					albumbsFromFlikrById[albumFromFlickrId].title,
					albumbsFromFlikrById[albumFromFlickrId].description
			);
			console.log("Row Found: " + (updateAlbumStatus.affectedRows ? true : false));
			console.log("Row Updated: " + (updateAlbumStatus.changedRows ? true : false) + "\n");
		}
	}
	console.log("********** /Missing DB Album Check and Insert **********")

	return;
}

async function getAlbumPhotos(albumId) {

	console.log(`********** API get Album photos for ${albumId} **********`);

	return new Promise((resolve, reject) => {
		https.get(`https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${api.key}&photoset_id=${albumId}&extras=date_taken,url_sq,url_s,url_m,url_o,geo,tags&privacy_filter=1&user_id=${api.userId}&per_page=100&format=json&nojsoncallback=1`,
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
								console.log(`Error parsing JSON from getPhotoAlbums(${albumId})`);
								console.log(e)
							}
						} else {
							console.log(`getPhotoAlbums(${albumId}) bad status code (${res.statusCode})`);
						}
					});
				}).on('error', (e) => {
					console.log(`getPhotoAlbums(${albumId}) API response error`);
					console.error(e);

					reject(e);
				});
	}).catch(err => {
		console.log(`getPhotoAlbums(${albumId}) Promise Error`);
		console.log(err);
	});
}

async function processPhotos(photos, albumId) {
	let photoValues = [], // hold an array of sql insert values
		result,
		albumPhotos;

	// Create an array of insert values for a multi-insert sql operatiom
	photos.photo.map((photo, index) => {
		if(photo.ispublic) {
			photoValues.push([
				photo.id,
				albumId,
				index,
				photo.title,
				photo.url_sq, photo.height_sq, photo.width_sq,
				photo.url_s, photo.height_s, photo.width_s,
				photo.url_m, photo.height_m, photo.width_m,
				photo.datetaken]);
		}
	});

	if(photoValues.length) {
		result = await flickrModel.savePhotos(photoValues);

		if(result.failed) {
			console.log(result.reason)

			if(result.errno === 1062) {
				// Photo already exists. If different title then update

				// Retrieve DB photos and match with Flickr photo ids and title for updating
				photos.photo.map(async photo => {
					albumPhotos = await flickrModel.getAlbumPhotos(photo.id);
					console.log(albumPhotos)
					//assign to an Object to compare titles

				});


			}
		} else {
			console.log(`SUCCESS: Inserted ${result.affectedRows} photos`);

			result = await flickrModel.savePhotoURLS();

			if(result.failed) {
				console.log(result.reason);
			} else {
				console.log(`SUCCESS: Created ${result.affectedRows} photo Title URLS`);
			}
		}
	} else {
		console.log("No albums found to insert");
	}

	return true;
}

setAPICreds();
//processCollections(api);

let myPromise = new Promise((resolve, reject) => {
	processCollections(api);
	resolve("success")
})

myPromise.then((message) => {
	console.log(message)
})

//flikrDS.end();
