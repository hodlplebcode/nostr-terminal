import 'dotenv/config'

import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool'
// import { useWebSocketImplementation } from 'nostr-tools/relay'
import { WebSocket } from 'ws'

import { bytesToHex } from '@noble/hashes/utils'
import { bech32 } from 'bech32';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const NSEC = bytesToHex(bech32Decoder('nsec', process.env.NSEC));
const NPUB = bytesToHex(bech32Decoder('npub', process.env.NPUB));

useWebSocketImplementation(WebSocket);
const pool = new SimplePool()
let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net']

start();

function start() {
  console.clear();
  showLogo();
  showMenu();
}

function showLogo() {
  console.log(`########################`);
  console.log(`#    NOSTR TERMINAL    #`);
  console.log(`########################`);
}

async function showMenu() {
  console.log("\x1b[0m");
  console.log(`########################`);
  console.log(`###### MAIN MENU #######`);
  console.log(`########################`);
  console.log(`[V]iew [F]eed`);
  console.log(`[W]rite a Note`);
  console.log(`[E][X]it`);
  console.log(`[H]elp`);

  const action = await rl.question('Choose Action: ');

  switch(action.charAt(0).toLowerCase()) {
    case "v":
    case "f":
      runView();
      break;
    case "w":
      runWrite();
      break;
    case "e":
    case "x":
      runExit();
      break;
    case "h":
      runHelp();
      break;
    default:
      console.clear();
      showMenu();
  }
}

async function runView() {

  let authorsArray = await getFollows();

  // const pool = new SimplePool()
  // let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net']
  // const relay = await Relay.connect('wss://nos.lol/')
  let eventArray = [];
  let npubArray = [];
  let lineEnd = '>';

  let sub = pool.subscribeMany([...relays],[
  // const sub = relay.subscribe([
      {
        kinds: [0],
        limit: 100,
        authors: authorsArray
      },
      {
        kinds: [1],
        limit: 100,
        authors: authorsArray
      }
    ], {
    onevent(event) {
      process.stdout.write('\rFetching Stream '+'='.repeat((eventArray.length + npubArray.length)/10))
      if (event.kind === 0) {
        npubArray.push({ pubkey: event.pubkey, content: JSON.parse(event.content)}); // add each Meta Event to npubArray
      } else if (event.kind === 1) {
        eventArray.push(event) // add each Note Event to eventArray
      }
    },
    oneose() {
      // TODO add sorting
      sub.close();

      eventArray = sortTimeline(eventArray);
      showNextNote(eventArray, npubArray);
    }
  })

}

function sortTimeline(eventArray) {
  eventArray.sort((a, b) => {
    if (a.created_at < b.created_at) {
        return 1; // b comes before a
    }
    if (a.created_at > b.created_at) {
        return -1; // a comes before b
    }
    return 0; // a and b are equal
  });
  return eventArray;
}

function getFollows() {
  return new Promise((resolve, reject) => {
    console.log("Fetching Follow List ...")
    let authorsArray = [];
    let eventResponse;

    let sub = pool.subscribeMany([...relays],[
    // const sub = relay.subscribe([
        {
          kinds: [3], // kind 3 is the follower list
          authors: [NPUB] // npub hex
        },
      ], {
      onevent(event) {
        eventResponse = event // add each event to eventArray
      },
      oneose() {
        // end of subscrption
        // loop through tags and add to authorsArray
        for(let tag of eventResponse.tags) {
          // Convert Unix timestamp to milliseconds
          if (tag[0] === "p") {
            authorsArray.push(tag[1])
          }
        }
        sub.close();
        resolve(authorsArray)
      }
    })
  }); // end Promise =>

}


let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let dateFormat = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: true // Use 24-hour format
};

async function showNextNote(eventArray, npubArray) {
    // Convert Unix timestamp to milliseconds
    let date = new Date(eventArray[0].created_at * 1000);
    let formattedDate = new Intl.DateTimeFormat('en-US', dateFormat).format(date);

    let fg = eventArray.length % 2 === 0 ? "\x1b[30m" : "\x1b[37m";
    let bg = eventArray.length % 2 === 0 ? "\x1b[47m" : "\x1b[40m";

    let npub = npubArray.find(obj => obj.pubkey === eventArray[0].pubkey);
    let displayName = 'Name Not Found'
    if (npub?.content?.display_name) {
      displayName = npub.content.display_name;
    } else if (npub?.content?.displayName) {
      displayName = npub.content.displayName;
    } else if (npub?.content?.npub) {
        displayName = npub?.content?.npub.substring(0,7) + "...";
    } else if (eventArray[0]?.pubkey) {
      displayName = eventArray[0].pubkey.substring(0,7) + "...";
    }

    // convert nostr:note to a primal.net link
    let content = eventArray[0].content;
    const startIndex = content.indexOf("nostr:note");
    if (startIndex !== -1) {
      const endIndex = content.indexOf(" ", startIndex);
      const linkEndIndex = endIndex === -1 ? content.length : endIndex;
      const link = content.substring(startIndex, linkEndIndex);
      const replacementUrl = `QUOTED: http://www.primal.net/e/note${link.substring(10)}`;
      content = content.replace(link, replacementUrl);
    }

    console.log(`${bg}${fg}`); // set background & foreground colors
    console.log('='.repeat(50)); // draw a dividing line
    console.log(`\n${displayName} @ ${formattedDate}\n${content}\n`)
    console.log('='.repeat(50)); // draw a dividing line

    if (eventArray.length > 1) {
      const action = await rl.question('[Enter], [M]ain Menu, [R]eload: ');

      if (action.charAt(0).toLowerCase() === "m") {
        console.clear();
        showMenu();
      } else if (action.charAt(0).toLowerCase() === "r") {
        console.clear();
        console.log(`Reloading Feed ...`);
        runView();
      } else {
        eventArray.shift();
        showNextNote(eventArray, npubArray);
      }
    } else {
      console.log("#############################################");
      console.log("### You have reached the end of your feed ###");
      console.log("#############################################");
      showMenu();
    }
}

async function runWrite() {
  // console.log("runWrite");
  // let nsec = await rl.question('Enter your nsec -or- press [enter] for .env: ');
  let eventContent = await rl.question('Enter your Note Text: ');
  eventContent = eventContent.replace(/\\n/g, '\n')

  // use finalizeEvent from nostr-tools to get the event.id, event.pubkey, event.sig
  const createdAt = Math.floor(Date.now() / 1000);
  const event = finalizeEvent({
    kind: 1,
    created_at: createdAt,
    tags: [],
    content: eventContent,
  }, NSEC)


  if (!verifyEvent(event)) {
    runError();
  } else {
    console.log(`####################################`);
    console.log(`# Your event is ready to broadcast #`);
    console.log(`####################################`);
    runWriteBroadcast(event);
  }
}

async function runWriteBroadcast(event) {
  const eventAction = await rl.question('[B]roadcast, [V]iew JSON, [M]ain Menu: ');

  switch(eventAction.charAt(0).toLowerCase()) {
    case "b":
      console.clear();
      console.log(`Broading to relay pool ...`)
      await Promise.any(pool.publish(relays, event));
      console.log(`\nCongratulations! Your event has broadcast to the network!`);
      showMenu();
      break;
    case "v":
      const eventJson = `[
        "EVENT",
        {
            "id": "${event.id}",
            "pubkey": "${event.pubkey}",
            "created_at": ${event.created_at},
            "kind": 1,
            "content": "${event.content}",
            "tags": [],
            "sig": "${event.sig}"
        }
      ]`;
      console.log(`${eventJson}`); // this is the json output
      runWriteBroadcast(eventJson);
      break;
    case "m":
      showMenu();
      break;
    default:
      console.log(`! Invalid Option, Try Again`);
      runWriteBroadcast(event);
  }
}

async function runHelp() {
  console.clear();

  console.log(`########################`);
  console.log(`#  NOSTR TERMINAL HELP #`);
  console.log(`########################\n`);

  console.log(`On the Main Menu:`);
  console.log(`Enter VIEW, V, or F to view your feed`);
  console.log(`Enter WRITE or W to write a note`);
  console.log(`Enter EXIT, E, or X to exit the program\n`);

  console.log(`On the View Feed screen:`);
  console.log(`The feed will show 1 note at a time`);
  console.log(`The feed will show your 100 most recent notes`);
  console.log(`Press the ENTER button to reveal the next note`);
  console.log(`Enter R to reload the feed and see the newest note`);
  console.log(`Enter M to return to the Main Menu\n`);

  console.log(`On the Write Note screen:`);
  console.log(`Enter the text you want in your note`);
  console.log(`You can use \\n to create a line break`);
  console.log(`(example: this has \\n one line break)`);
  console.log(`Press ENTER when you are done with your text`);
  console.log(`You then see the Broadcast Menu\n`);

  console.log(`On the Broadcast Menu:`);
  console.log(`Enter V to View the JSON of your event`);
  console.log(`Enter B to Broadcast your event to the network`);
  console.log(`(you will see "Your event has broadcast" + the Main Menu)`);
  console.log(`Enter M to return to the Main Menu\n`);

  const action = await rl.question('Press [ENTER] to continue: ');
  console.clear();
  showMenu();

}

function runExit() {
  rl.close();
  process.exit(1);
}

function runError() {
  console.log(`Something Went Wrong !!!`)
  runExit();
}

function bech32Decoder(currPrefix, data) {
  const { prefix, words } = bech32.decode(data);
  if (prefix !== currPrefix) {
      throw Error('Invalid address format');
  }
  return Buffer.from(bech32.fromWords(words));
}
