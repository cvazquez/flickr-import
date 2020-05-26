const	https	= require("https"),
		oauth	= require("./oauth");

exports.api = class api {
	constructor(flickrModel, userName) {
		this.flickrModel	= flickrModel;
		this.restEndpoint	= "https://www.flickr.com/services/rest";
		this.userName		= userName;

		return (async () => {
			this.api = await this.getAPICreds();
			this.OAuthTokens = await this.flickrModel.getOAuthAccessToken(this.userName);

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

	async getCollectionAlbumsOAuth(collectionId) {
		const	queryKeyValues			= {
											collection_id	: collectionId,
											method			: "flickr.collections.getTree",
											//user_id			: this.OAuthTokens[0].userNSid,
											format			: "json",
											nojsoncallback	: 1
										},
				requestQueryString		= oauth.getRequestTokenQueryString(
															"GET",
															this.api,
															this.restEndpoint,
															null,
															this.OAuthTokens[0].oauthToken,
															null,
															this.OAuthTokens[0].oauthTokenSecret,
															queryKeyValues),
				url						= `${this.restEndpoint}?` + requestQueryString;

		process.stdout.write(`\n\n********** OAuth API get Collection Albums for ${collectionId} **********\n`);

		return await this.getMethodWithOAuth(url);

	}

	async getAlbumPhotosOAuth(albumId) {
		const	queryKeyValues			= {
											method			: "flickr.photosets.getPhotos",
											extras			: "description,date_taken,url_sq,url_s,url_m,url_o",
											photoset_id		: albumId,
											privacy_filter	: 1,
											user_id			: this.api.userId,
											//per_page		: 100,
											format			: "json",
											nojsoncallback	: 1
										},
				requestQueryString		= oauth.getRequestTokenQueryString(
															"GET",
															this.api,
															this.restEndpoint,
															null,
															this.OAuthTokens.oauth_token,
															null,
															null,
															queryKeyValues),
				url						= `${this.restEndpoint}?` + requestQueryString;

		process.stdout.write(`\n\n********** API get Album photos for ${albumId} **********\n`);

		return await this.getMethodWithOAuth(url);
	}


	async getMethodWithOAuth(url) {

		return new Promise((resolve, reject) => {
			https.get(url,
					(res) => {
						var body = '';

						res.on('data', function(chunk){
							body += chunk;
						});

						res.on("end", () => {
							if(res.statusCode === 200) {
								try {
									let jsonResponse = JSON.parse(body);

									if(!jsonResponse.stat || jsonResponse.stat !== "ok") {
										if(jsonResponse.stat && jsonResponse.stat === "fail" && jsonResponse.message) {
											reject(`\n\n API MESSAGE: ${jsonResponse.message} \n\n`);

											return false;
										} else {
											reject("Error parsing JSON");
											return false;
										}
									}

									resolve(jsonResponse);
								} catch(e) {

									process.stdout.write(`\n\nError parsing JSON`);
									reject(e);
								}
							} else {
								reject(`\nBad status code (${res.statusCode})\n`);
								return false;
							}
						});
					}).on('error', (e) => {
						process.stdout.write(`\nAPI response error\n`);
						reject(e);
						return false;
					});
		}).catch(err => {
			process.stdout.write(err);

			process.stdout.write(`\nPromise Error\n`);
			console.log(url)
			return false;
		});
	}
}