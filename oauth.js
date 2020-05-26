/*
	Flick OAuth Login
	Author: Carlos Vazquez (cvazquez1976@gmail.com)
	Personal Website: http://www.carlosvazquez.org
	Repo: https://github.com/cvazquez/flickr-import
	Date: 5/25/2020

	Flickr OAuth Guide
	https://www.flickr.com/services/api/auth.oauth.html

	Some Fun
	https://www.youtube.com/watch?v=H8Q83DPZy6E
*/

const	flikrDS			= require('./connectors/mysql'),
		dbConnection	= flikrDS.connection,
		flickrClass		= require("./models/flickr").flickrModel,
		flickrModel		= new flickrClass(dbConnection),
		apiClass		= require('./components/api').api,
		rl				= require('readline').createInterface({
							input: process.stdin,
							output: process.stdout
						}),
		oauth			= require('./components/oauth');

( async () =>{
	let api						= await new apiClass(flickrModel),
		apiCreds				= await api.getAPICreds(),
		requestTokenURL			= "https://www.flickr.com/services/oauth/request_token",
		requestTokenQueryString	= oauth.getRequestTokenQueryString("GET", apiCreds, requestTokenURL, "oob"),
		requestTokenFullURL 	= requestTokenURL + "?" + requestTokenQueryString,
		requestTokenResponse,
		responseKeyValues,
		requestAuthorizeURL		= "https://www.flickr.com/services/oauth/authorize",
		requestAccessTokenURL 	= "https://www.flickr.com/services/oauth/access_token";

	requestTokenResponse = await oauth.requestToken(requestTokenFullURL);
	responseKeyValues = oauth.getResponseKeyValues(requestTokenResponse);

	if(responseKeyValues.oauth_callback_confirmed) {

		console.log("\n\nIMPORTANT: Go to the following URL, Click 'OK, I'll Authorize it' and copy the code given:");
		console.log(requestAuthorizeURL + "?oauth_token=" + responseKeyValues.oauth_token)

		rl.question("\nEnter Authorization Code: ", async oauth_verifier => {
			const	requestAccessTokenQueryString	= oauth.getRequestTokenQueryString(
																"GET",
																apiCreds,
																requestAccessTokenURL,
																null,
																responseKeyValues.oauth_token,
																oauth_verifier.trim(),
																responseKeyValues.oauth_token_secret),
					requestAccessTokenResponse	= await oauth.requestToken(
																requestAccessTokenURL +
																"?" +
																requestAccessTokenQueryString),
					responseAccessTokenKeyValues= oauth.getResponseKeyValues(requestAccessTokenResponse),
					oAuthSaveResponse 			= await flickrModel.saveOAuth(
																decodeURIComponent(responseAccessTokenKeyValues.user_nsid),
																decodeURIComponent(responseAccessTokenKeyValues.fullname),
																decodeURIComponent(responseAccessTokenKeyValues.username),
																decodeURIComponent(responseAccessTokenKeyValues.oauth_token),
																decodeURIComponent(responseAccessTokenKeyValues.oauth_token_secret));
			if(oAuthSaveResponse.affectedRows === 1) {
				console.log("\nSaved your Access Tokens to the DB with the following values. Use these to access API.")
				console.log(responseAccessTokenKeyValues)
			} else {
				console.log("\nISSUE saving you access tokens. See the following errors:\n");
				console.log(oAuthSaveResponse);
			}

			flikrDS.close(dbConnection);

			rl.close();
		});
	} else {
		console.error("********* Failed response Requesting Tokens *********")
	}
})();