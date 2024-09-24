This is a script that allows you to read your Nostr feed and broadcast notes to the Nostr protocol.

### Screenshots

![Main Menu](https://m.primal.net/LAdz.png)  

![View Feed](https://m.primal.net/LAeB.png )  

![Write Note](https://m.primal.net/LAeC.png )  

![Broadcast](https://m.primal.net/LAeD.png)


### Setup
Create a .env, in your root directory, that has your favorite nsec and npub. (You can also use this random nsec: `nsec1slgfeunlur9z8jj064jzed0cveee9mzxtp3lcxh454n9u0504jgq7r5fc3`)

The nsec is used for broadcasting notes to the protocol.
The npub is used for pulling the feed of followed npubs.

Your .env should look like this:
```
NSEC = 'nsec1slgfeunlur9z8jj064jzed0cveee9mzxtp3lcxh454n9u0504jgq7r5fc3'
NPUB = 'npub1s0cuk03k5ms4lrums4f3pvmnr0t9weqvuygjt653pw7rp0vgz9tszf6sy3'
```

### Run The Script
1. Open Terminal

1. Navigate to your root directory  
`cd /my/repos/nostr-terminal`

1. Install dependencies  
`npm i`

1. Start the script  
`npm start`
