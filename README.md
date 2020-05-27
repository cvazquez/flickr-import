# flickr-import
Node.js script to import Flickr collections, album and photo data into a MySQL DB, for use on my blog

**WARNING: USE AT YOUR OWN RISK**

INSTRUCTIONS
------------

Create these tables in a DB of your choice:
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/adminsettings.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrcollections.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsetphotos.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsetphotourls.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickrsets.sql
https://github.com/cvazquez/databases/blob/master/cvazquezblog/tables/flickroauth.sql

1. In flickcollections, insert a record with your Flickr collection information.
2. In adminsettings, see supplied insert statements and fill in your Flickr API information
3. All other tables are filled in with the flickr.js script
4. Ultimately flickrsetphotos will have links to small and medium versions of a Flickr Albums photos, along with their title, descript and date/time taken. 
5. See Flickr API for extra information available to import https://www.flickr.com/services/api/


**Checkout a cloned copy of the flickr-import code**
> $ sudo git clone https://github.com/cvazquez/flickr-import.git flickr-import


**Install**
> cd flickr-import

> sudo npm install


**Database Credentials**
For Database Credentials, create a folder and a file, in a DIRECTORY UP called ../config/mysql.js
with this object exporting.

```
exports.cred  =   {
    host        : 'localhost',
    user        : '[your DB username]',
    password    : '[your DB password]',
	database    : '[Your DB name]',
	supportBigNumbers	: true,
	bigNumberStrings	: true
};
```


##How to run:

**Create OAuth tokens**
(Your will be given a link to Flickr, where you have to login and Accept access to your account. A code will be given that you enter into the prompt the following script asks for.)
> sudo node oauth.js

**Import Flickr Photos**
> sudo node flickr.js userName=[your flickr userid]
