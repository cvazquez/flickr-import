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

const	// Connect to MySQL DB
		flikrDS			= require('./connectors/mysql'),
		dbConnection	= flikrDS.connection,

		// Create an instance of flickrClass with DB queries
		flickrClass		= require("./models/flickr").flickrModel,
		flickrModel		= new flickrClass(dbConnection),

		// API Class is used to retrieve API credentials from the DB
		apiClass		= require('./components/api').api,

		// r1 will prompt the user for their oAuth verifier code
		rl				= require('readline').createInterface({
							input: process.stdin,
							output: process.stdout
						}),

		// oAuth Library to make signed request strings, API requests and parse responses
		oauth			= require('./components/oauth');

( async () =>{
	let
		// DB call to get API key, secret and user id
		api						= await new apiClass(flickrModel),
		apiCreds				= await api.getAPICreds(),

		// Request URLs
		requestTokenURL			= "https://www.flickr.com/services/oauth/request_token",
		requestAuthorizeURL		= "https://www.flickr.com/services/oauth/authorize",
		requestAccessTokenURL 	= "https://www.flickr.com/services/oauth/access_token",

		// Create a signed request query string based on API key and url to get a Request Token - https://www.flickr.com/services/api/auth.oauth.html#signing
		requestTokenQueryString	= oauth.getSignedRequestTokenQueryString("GET", apiCreds, requestTokenURL, "oob"), // oob is non-browser based authentication
		requestTokenFullURL 	= requestTokenURL + "?" + requestTokenQueryString,

		// Get our request Token - https://www.flickr.com/services/api/auth.oauth.html#request_token
		requestTokenResponse 	= await oauth.requestToken(requestTokenFullURL),
		responseKeyValues 		= oauth.getResponseKeyValues(requestTokenResponse);


	// Confirmation if API credentials are correctly signed and return an oAuth Token, used to get an Access Token
	if(responseKeyValues.oauth_callback_confirmed) {

		// User Authorization
		// We're doing a non-browser based authentication, so direct user to page to retrieve their code
		// https://www.flickr.com/services/api/auth.oauth.html#authorization
		console.log("\n\nIMPORTANT: Go to the following URL, Click 'OK, I'll Authorize it' and copy the code given:");
		console.log(requestAuthorizeURL + "?oauth_token=" + responseKeyValues.oauth_token)

		// User will enter the oauth verifier code given on the Flickr requestAuthorizeURL website
		rl.question("\nEnter Authorization Code: ", async oauth_verifier => {

			// Exchanging the Request Token for an Access Token
			// https://www.flickr.com/services/api/auth.oauth.html#access_token
			const	// Create a signed request from oAuth Token and the oAuth Verifier Code user entered
					requestAccessTokenQueryString	= oauth.getSignedRequestTokenQueryString(
																"GET",
																apiCreds,
																requestAccessTokenURL,
																null,
																responseKeyValues.oauth_token,
																oauth_verifier.trim(),
																responseKeyValues.oauth_token_secret),
					// Make another request for the Access Token
					requestAccessTokenResponse	= await oauth.requestToken(
																requestAccessTokenURL +
																"?" +
																requestAccessTokenQueryString),
					// Parse Access Token from response
					responseAccessTokenKeyValues= oauth.getResponseKeyValues(requestAccessTokenResponse),

					// Access token is saved for future API requests
					oAuthSaveResponse 			= await flickrModel.saveOAuth(
																decodeURIComponent(responseAccessTokenKeyValues.user_nsid),
																decodeURIComponent(responseAccessTokenKeyValues.fullname),
																decodeURIComponent(responseAccessTokenKeyValues.username),
																decodeURIComponent(responseAccessTokenKeyValues.oauth_token),
																decodeURIComponent(responseAccessTokenKeyValues.oauth_token_secret));

			// Confirm Access Token was saved to the DB successfully
			if(oAuthSaveResponse.affectedRows === 1) {
				console.log("\nSaved your Access Tokens to the DB with the following values. Use these to access API.")
				console.log(responseAccessTokenKeyValues)

console.log("\n\n user name = " + responseAccessTokenKeyValues.username);
				// Test login
				const	// Create a new api instance, that retieves the latest oAuth access tokens just created for this user
						apiTest				= await new apiClass(flickrModel, decodeURIComponent(responseAccessTokenKeyValues.username)),
						oAuthTestResponse	= await apiTest.getOAuthTest();

					console.log(oAuthTestResponse);

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