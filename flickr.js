const	flikrDS			= require('./connectors/mysql').connection,
		flickrObject	= require("./models/flickr").flickrModel,
		flickrModel		= new flickrObject(flikrDS),
		https			= require("https");

(async () => {
	const	collections = await flickrModel.getCollections(),
			apiCreds	= await flickrModel.getCredentials();

	let		apiKey,
			apiSecret,
			apiUserId;

	apiCreds.map(cred => {
		switch(cred.name) {
			case "flickrAPIKey":
				apiKey = cred.value;
			break;
			case "flikrAPISecret":
				apiSecret = cred.value;
			break;
			case "flickrUserId":
				apiUserId = cred.value;
			break;
		}
	});

	collections.map(collection => {

		https.get(`https://api.flickr.com/services/rest/?method=flickr.collections.getTree&api_key=${apiKey}&collection_id=${collection.id}&user_id=${apiUserId}&format=json`,
				(res) => {
					res.setEncoding("utf8");

					res.on("data", data => {

						function jsonFlickrApi(rsp){
							if(!rsp.stat || rsp.stat !== "ok" || !rsp.collections || !rsp.collections.collection || !rsp.collections.collection[0] || !rsp.collections.collection[0].set) {
								return false;
							}
							return rsp.collections.collection[0].set;
						}

						// The api response returns a function called jsonFlickrApi with the json as an argument
						const albums = eval(data);
						processAlbums(albums);
					});
		});

	});


})();

async function processAlbums(albumbsFromFlikr) {
	const albumIdsFromFlickr = [];
	let albumbsFromFlikrById = {},
		albumbsFromDBById = {};

	albumbsFromFlikr.map(album => {
		albumIdsFromFlickr.push(album.id)

		// Popuplate a new object that uses the album id as a key
		albumbsFromFlikrById[album.id] = {
			title		: album.title,
			description	: album.description
		}
	});

	// Get albums stored in the DB
	const albumInfo = await flickrModel.getAlbumInfo(albumIdsFromFlickr);

	//Loop through albums in local database and find any that don't exist from flickr api
	albumInfo.map(album => {
		if(!albumbsFromFlikrById.hasOwnProperty(album.id)) {
			// Album in Database doesn't exist at flickr
			console.log("Missing album at Flickr that is in the DB : ");
			console.log(album);
		}

		albumbsFromDBById[album.id] = {
			title		: album.title,
			description	: album.description
		}
	});

	// Check for albums retrieved from Flikr that are not stored in the DB
	for(let albumFromFlickrId in albumbsFromFlikrById) {
		if(!albumbsFromDBById.hasOwnProperty(albumFromFlickrId)) {
			console.log("Album from Flickr is Missing from the DB");
			console.log(albumFromFlickrId)
			console.log(albumbsFromFlikrById[albumFromFlickrId]);
		}
	}

	flikrDS.end();
}