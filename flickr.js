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

setAPICreds();


let processCollections = async (api) => {
	const	collections = await flickrModel.getCollections();

	collections.map((collection, index) => {

		https.get(`https://api.flickr.com/services/rest/?method=flickr.collections.getTree&api_key=${api.key}&collection_id=${collection.id}&user_id=${api.userId}&format=json`,
				(res) => {
					res.setEncoding("utf8");

					res.on("data", data => {
						let albums,
							err;

						function jsonFlickrApi(rsp){
							if(!rsp.stat || rsp.stat !== "ok" ||
								!rsp.collections || !rsp.collections.collection ||
								!rsp.collections.collection[0] || !rsp.collections.collection[0].set)
								return false;

							return rsp.collections.collection[0].set;
						}

						// The api response returns a function called jsonFlickrApi with the json as an argument
						albums = eval(data);

						if(albums) {
							processAlbums(albums, collection.id);
						} else {
							console.log("Error accessing Collections")
							flikrDS.end();
						}

						console.log(index);
					});
		}).on('error', (e) => {
			console.log("error")
			console.error(e);
		});
	});
};

(async ()=> {

	let process = await processCollections(api);

	if(process) {
		console.log("close db connection")
		flikrDS.end();
	}
})();

function createAlumIdsFromFlickr(albumbsFromFlikr) {
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

async function getDatabaseAlbums(albumIdsFromFlickr, albumbsFromFlikrById) {
	// Get albums stored in the DB
	let albumbsFromDBById = {};
	const albumsInDB = await flickrModel.getAlbumInfo(albumIdsFromFlickr);

	//Loop through albums in local database and find any that don't exist from flickr api
	console.log("********** DB Albums **********")
	albumsInDB.map(album => {
		if(!albumbsFromFlikrById.hasOwnProperty(album.id)) {
			// Album in Database doesn't exist at flickr
			console.log("Missing album at Flickr that is in the DB : ");
			console.log(album);
		}

		console.log(album.title + "\n" + (album.description.length ? "* " + album.description + "\n" : ""));

		albumbsFromDBById[album.id] = {
			title		: album.title,
			description	: album.description
		}
	});
	console.log("********** /DB Albums **********\n\n")

	return albumbsFromDBById;
}

async function setMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId) {
	let createdAlbum;

	// Check for albums retrieved from Flikr that are not stored in the DB and create
	console.log("********** Missing DB Album Check and Insert **********")
	for(let albumFromFlickrId in albumbsFromFlikrById) {
		if(!albumbsFromDBById.hasOwnProperty(albumFromFlickrId)) {

			console.log("Album from Flickr is Missing from the DB. Creating....");
			console.log(albumFromFlickrId)
			console.log(albumbsFromFlikrById[albumFromFlickrId]);

			createdAlbum = await flickrModel.saveAlbum(
				albumFromFlickrId,
				collectionId,
				albumbsFromFlikrById[albumFromFlickrId].title,
				albumbsFromFlikrById[albumFromFlickrId].description);


			if(!createdAlbum.failed) {
				process.stdout.write(createdAlbum)
				process.stdout.write(`\nAlbum ***${albumbsFromFlikrById[albumFromFlickrId].title}*** `);
				if(!createdAlbum.affectedRows) {
					process.stdout.write("NOT ");
				}
				process.stdout.write("inserted into DB\n\n");
			} else {
				console.log(`Failed Creating Album ***${albumbsFromFlikrById[albumFromFlickrId].title}***`);
				console.log(createdAlbum.reason);
			}
		}
	}
	console.log("********** /Missing DB Album Check and Insert **********")
}

async function getAlbumPhotos(albumId) {
	https.get(`https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${api.key}&photoset_id=${albumId}&extras=date_taken,url_sq,url_s,url_m,url_o,geo,tags&privacy_filter=1&user_id=${api.userId}&per_page=5&format=json`,
			(res) => {
				res.setEncoding("utf8");

				res.on("data", data => {
					let photos;

					function jsonFlickrApi(rsp){
						if(!rsp.stat || rsp.stat !== "ok" || !rsp.photoset) {
							return false;
							console.log("rsp error")
						}

						return rsp.photoset;
					}

					// The api response returns a function called jsonFlickrApi with the json as an argument
					photos = eval(data);

					if(photos) processPhotos(photos, albumId);
				});
			}).on('error', (e) => {
				console.error(e);
			});
}

// Check if Flickr Albums are in DB and vice versa
async function processAlbums(albumbsFromFlikr, collectionId) {
	let	albumIdsFromFlickr = [],
		albumbsFromFlikrById = {},
		albumbsFromDBById = {};

	[albumIdsFromFlickr, albumbsFromFlikrById] = createAlumIdsFromFlickr(albumbsFromFlikr);

	albumbsFromDBById = await getDatabaseAlbums(albumIdsFromFlickr, albumbsFromFlikrById);

	await setMissingDatabaseAlbums(albumbsFromFlikrById, albumbsFromDBById, collectionId);

	for(let albumId in albumbsFromDBById) {
		await getAlbumPhotos(albumId);
	}
	//await getAlbumPhotos();
}

async function processPhotos(photos, albumId) {
	let photoValues = [],
		result;

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
}