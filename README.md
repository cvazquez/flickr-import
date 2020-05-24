# flickr-import
Node.js script to import Flickr collections, album and photo data into a MySQL DB, for use on my blog

*** WARNING: USE AT YOUR OWN RISK *****

INSTRUCTIONS
------------

Create these tables in a DB of your choice:
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/adminsettings.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrcollections.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsetphotos.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsetphotourls.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsets.sql

* In flickcollections, insert a record with your Flickr collection information.
* In adminsettings, see supplied insert statements and fill in your Flickr API information
* All other tables are filled in with the flickr.js script
* Ultimately flickrsetphotos will have links to small and medium versions of a Flickr Albums photos, along with their title, descript and date/time taken. 
* See Flickr API for extra information available to import https://www.flickr.com/services/api/


Checkout a cloned copy of the flickr-import code
$ sudo git clone https://github.com/cvazquez/flickr-import.git flickr-import


Install
$ cd flickr-import
$ sudo npm install


For Database Credentials, create a folder and a file, in a DIRECTORY UP called ../config/mysql.js
with this object exporting.

// Start DB code (Fill in your DB credentials)
exports.cred  =   {
    host        : 'localhost',
    user        : '[your DB username]',
    password    : '[your DB password]',
	database    : '[Your DB name]',
	supportBigNumbers	: true,
	bigNumberStrings	: true
};
// End DB code


How to run:
$ sudo npm run dev
or
$ sudo node flickr.js