# AIS ship positions with node.js

## Getting started

### On Ubuntu 12.04:

#### 1. Install node.js

    $ sudo add-apt-repository -y ppa:chris-lea/node.js
    $ sudo apt-get update 
    $ sudo apt-get install nodejs nodejs-dev npm

#### 2. Install Redis

To get the latest stable version (2.6) it's best to compile from source (Ubuntu's package management version is pretty old).

The latest version can be found [here](http://www.redis.io/download).
    
##### 2.1 Compiling

    $ sudo apt-get update
    $ sudo apt-get install build-essential tcl8.5
    $ wget http://redis.googlecode.com/files/redis-2.6.2.tar.gz
    $ tar xzf redis-2.6.2.tar.gz
    $ cd redis-2.6.2
    $ sudo make
    $ sudo make install

##### 2.2 Config File
    
    $ sudo mkdir /etc/redis
    $ sudo cp redis.conf /etc/redis/redis.conf
    $ sudo nano redis.conf

    daemonize yes
    bind 127.0.0.1
    logfile /var/log/redis/redis.log
    dir /var/lib/redis

##### 2.3 Redis user and permissions
    
    sudo useradd redis
    sudo mkdir -p /var/lib/redis
    sudo mkdir -p /var/log/redis
    sudo chown redis:redis /var/lib/redis
    sudo chown redis:redis /var/log/redis

##### 2.4 Init script

    $ wget https://raw.github.com/gist/3972465/815c336314e82480c89764357fe70e01231c9c14/redis-server
    $ sudo mv redis-server /etc/init.d/redis-server
    $ sudo chmod +x /etc/init.d/redis-server
    $ sudo update-rc.d redis-server defaults
    $ sudo /etc/init.d/redis-server start

#### 3. Clone project

  via ssh

    git clone git@github.com:vesseltracker/ais_nodejs.git

  or via https

    git clone https://github.com/vesseltracker/ais_nodejs.git

#### 4. Install modules via NPM

    npm install
