const https	= require("https");

exports.api = class api {
	constructor(flickrModel) {
		this.flickrModel = flickrModel;

		return (async () => {
			this.api = await this.getAPICreds();

			return this;
		})();
	}

	async getAPICreds() {
		const apiCreds	= await this.flickrModel.getCredentials();
		let api = {
			key		: null,
			secret	: null,
			userId	: null
		};

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

		return api;
	}

	getCollectionAlbums(collectionId) {
		return new Promise((resolve, reject) => {
			https.get(`https://api.flickr.com/services/rest/?method=flickr.collections.getTree&api_key=${this.api.key}&collection_id=${collectionId}&user_id=${this.api.userId}&format=json&nojsoncallback=1`,
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

								resolve({set : jsonResponse.collections.collection[0].set});
							} catch(e) {

								process.stdout.write(`Error parsing JSON from getCollections(${collectionId})`);
								console.log(e);
								reject(e);
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

	async getAlbumPhotos(albumId) {

		process.stdout.write(`\n\n********** API get Album photos for ${albumId} **********\n`);

		return new Promise((resolve, reject) => {
			https.get(`https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${this.api.key}&photoset_id=${albumId}&extras=description,date_taken,url_sq,url_s,url_m,url_o,geo,tags&privacy_filter=1&user_id=${this.api.userId}&per_page=100&format=json&nojsoncallback=1`,
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

									resolve({set : jsonResponse.photoset});

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
}