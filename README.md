# AIS ship positions with node.js

## Getting started

### On Ubuntu 12.04:

#### 1. Install node.js

    $ sudo add-apt-repository -y ppa:chris-lea/node.js
    $ sudo apt-get update 
    $ sudo apt-get install nodejs nodejs-dev npm

#### 2. Install MongoDB

To get the newest stable version we have to add the official MongoDB repository to our sources.
    
    $ apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
    $ echo "deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen" | tee -a /etc/apt/sources.list.d/10gen.list
    $ apt-get update
    $ apt-get install mongodb-10gen

#### 3. Clone project

  via ssh

    git clone git@github.com:vesseltracker/ais_nodejs.git

  or via https

    git clone https://github.com/vesseltracker/ais_nodejs.git

#### 4. Install modules via NPM

    npm install
