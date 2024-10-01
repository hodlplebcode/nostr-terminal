import 'dotenv/config'

import { finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
// import { useWebSocketImplementation } from 'nostr-tools/relay'
import { WebSocket } from 'ws';

import { bytesToHex } from '@noble/hashes/utils';
import { bech32 } from 'bech32';;
import * as nip19 from 'nostr-tools/nip19';

// import { promises as fs } from 'fs';
// import { open } from 'open';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const NSEC = bytesToHex(bech32Decoder('nsec', process.env.NSEC));
const PUBKEY = bytesToHex(bech32Decoder('npub', process.env.NPUB));

useWebSocketImplementation(WebSocket);
const pool = new SimplePool()
let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.wine/', 'wss://nostr.lorentz.is/', 'wss://eden.nostr.land/']

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

start();

function start() {
  console.clear();
  logo();
  menu();
}

// ------------------ //
//       LOGO        //
function logo() {
  console.log(`########################`);
  console.log(`#    NOSTR TERMINAL    #`);
  console.log(`########################`);
}

// ------------------ //
//       MENU        //
async function menu() {
  console.log("\x1b[0m");
  console.log(`########################`);
  console.log(`###### MAIN MENU #######`);
  console.log(`########################`);
  console.log(`[V]iew [F]eed`);
  console.log(`[P]rofile`)
  console.log(`[W]rite a Note`);
  // TODO console.log(`[F]ollow List`);
  // TODO console.log(`[S]earch`);
  console.log(`[Q]uit`);
  console.log(`[H]elp`);

  const action = await rl.question('Choose Action: ');

  switch(action.charAt(0).toLowerCase()) {
    case "v":
    case "f":
      viewFeed();
      break;
    case "p":
      viewProfile();
      break;
    case "w":
      writeNote();
      break;
    case "q":
    case "x":
      exit();
      break;
    case "h":
      help();
      break;
    default:
      console.clear();
      menu();
  }
}

// ------------------ //
//     VIEW FEED     //
async function viewFeed() {

  let authorsArray = await getFollows();

  let eventArray = [];
  let npubArray = [];
  let progressBar = '';
  let x = 0;
  let y = 1;
  const blankLine = new Array(10).fill("░ ");

  let sub = pool.subscribeMany([...relays],[
      {
        kinds: [0],
        authors: authorsArray
      },
      {
        kinds: [1],
        limit: 100,
        authors: authorsArray
      }
    ], {
    onevent(event) {

      // break this out to a function
      if ((eventArray.length + npubArray.length) % 10 === 0) {
        let newLine = Array.from(blankLine);
        newLine[x] = "█ ";
        y = x>=(blankLine.length-1) ? -1 : y;
        y = x<=0 ? 1 : y;
        x+=y;
        progressBar = newLine.join('');
      }

      // TODO hide the cursor while the animation is going
      // process.stdout.write('\r#  Fetching Stream '+'='.repeat((eventArray.length + npubArray.length)/10))
      process.stdout.write('\r# Fetching '+progressBar+'  #')
      if (event.kind === 0) {
        npubArray.push({ pubkey: event.pubkey, content: JSON.parse(event.content)}); // add each Meta Event to npubArray
      } else if (event.kind === 1) {
        eventArray.push(event) // add each Note Event to eventArray
      }
    },
    oneose() {
      // TODO add sorting
      sub.close();
      process.stdout.write('\r');
      eventArray = sortTimeline(eventArray);
      showNote(eventArray, npubArray, 0);
    }
  })

}

// ------------------ //
//   SORT TIMELINE   //
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

// ------------------ //
//    GET FOLLOWS    //
function getFollows() {
  return new Promise((resolve, reject) => {
    console.log(`##################################`);
    console.log(`#     FETCHING FOLLOWED LIST     #`);
    console.log(`##################################`);
    let authorsArray = [];
    let eventResponse;

    let sub = pool.subscribeMany([...relays],[
    // const sub = relay.subscribe([
        {
          kinds: [3], // kind 3 is the follower list
          authors: [PUBKEY] // npub hex
        },
      ], {
      onevent(event) {
        eventResponse = event // add each event to eventArray
      },
      oneose() {
        // end of subscrption
        // loop through tags and add to authorsArray
        for(let tag of eventResponse?.tags) {
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

async function viewProfile() {

  let eventArray = [];
  let npubArray = [];
  let progressBar = '';
  let x = 0;
  let y = 1;
  const blankLine = new Array(10).fill("░ ");

  let sub = pool.subscribeMany([...relays],[
  // const sub = relay.subscribe([
      {
        kinds: [0],
        authors: [PUBKEY] // npub hex
      },
      {
        kinds: [1],
        limit: 100,
        authors: [PUBKEY]
      }
    ], {
    onevent(event) {

      if ((eventArray.length + npubArray.length) % 10 === 0) {
        let newLine = Array.from(blankLine);
        newLine[x] = "█ ";
        y = x>=(blankLine.length-1) ? -1 : y;
        y = x<=0 ? 1 : y;
        x+=y;
        progressBar = newLine.join('');
      }

      // TODO hide the cursor while the animation is going
      // process.stdout.write('\r#  Fetching Stream '+'='.repeat((eventArray.length + npubArray.length)/10))
      process.stdout.write('\r# Fetching '+progressBar+'  #')
      if (event.kind === 0) {
        npubArray.push({ pubkey: event.pubkey, content: JSON.parse(event.content)}); // add each Meta Event to npubArray
      } else if (event.kind === 1) {
        eventArray.push(event) // add each Note Event to eventArray
      }
    },
    oneose() {
      // TODO add sorting
      sub.close();
      process.stdout.write('\r');
      eventArray = sortTimeline(eventArray);
      showNote(eventArray, npubArray, 0);
    }
  })
};

async function showNote(eventArray, npubArray, index=0) {
    index = index < 0 ? 0 : index;
    const e = eventArray[index];
    // Convert Unix timestamp to milliseconds
    // const date = e?created_at ? e.created_at : Date()
    let date = new Date(e?.created_at * 1000);
    let formattedDate = new Intl.DateTimeFormat('en-US', dateFormat).format(date);

    let fg = index % 2 === 0 ? "\x1b[30m" : "\x1b[37m";
    let bg = index % 2 === 0 ? "\x1b[47m" : "\x1b[40m";

    let npub = npubArray.find(obj => obj.pubkey === e.pubkey);
    let displayName = 'Name Not Found'
    if (npub?.content?.display_name) {
      displayName = npub.content.display_name;
    } else if (npub?.content?.displayName) {
      displayName = npub.content.displayName;
    } else if (npub?.content?.npub) {
        displayName = npub?.content?.npub.substring(0,7) + "...";
    } else if (e?.pubkey) {
      displayName = e.pubkey.substring(0,7) + "...";
    }

    // convert nostr:note to a primal.net link
    let content = e.content;
    const startIndex = content.indexOf("nostr:note");
    if (startIndex !== -1) {
      const endIndex = content.indexOf(" ", startIndex);
      const linkEndIndex = endIndex === -1 ? content.length : endIndex;
      const link = content.substring(startIndex, linkEndIndex);
      const replacementUrl = `QUOTED: http://www.primal.net/e/note${link.substring(10)}`;
      content = content.replace(link, replacementUrl);
    }

    // TODO: Show likes, replies, etc

    console.log(`${bg}${fg}`); // set background & foreground colors
    console.log('='.repeat(50)); // draw a dividing line
    console.log(`\n${displayName} @ ${formattedDate}\n${content}\n`)
    console.log('='.repeat(50)); // draw a dividing line

    if (eventArray.length > 1) {
      let action = await rl.question('[Enter], [Q]uote, [R]eply, [T]op, [P]revious, [W]eb, [M]enu, [H]elp: ');
      // TODO [D]etails, [P]revious, [L]ike, [B]rowser

      switch (action.charAt(0).toLowerCase()) {
        // case "d":
        //   console.log("### Note Details ###")
        //   // show link to Primal?
        //   // likes, etc
        //   break;
        case "q": // quote
          writeNote(e.id, "QUOTE");
          break;
        case "r": // reply
          writeNote(e.id, "REPLY");
          break;
        case "t": // top
          console.clear();
          console.log(`Loading Feed ...`);
          viewFeed();
          break;
        case "p": // previous
          index--;
          showNote(eventArray, npubArray, index);
          break;
        case "w": // web
          const url = 'https://primal.net/e/note' + e.id;
          await open(url);
          break;
        case "m": // menu
          console.clear();
          menu();
          break;
        case "h": // help
          help();
          break;
        default: // next note
          index++;
          showNote(eventArray, npubArray, index);
      }
    } else {
      console.log("#############################################");
      console.log("### You have reached the end of your feed ###");
      console.log("#############################################");
      menu();
    }
}

async function writeNote(refEventId, action) {
  // refEventId is the event.id of another event
  // action can be "QUOTE" or "REPLY"
  let eventId;
  const allowedActions = ["QUOTE", "REPLY"];
  if (action !== undefined && allowedActions.includes(action)) {
    if (refEventId !== undefined && action === "QUOTE") {
      eventId = nip19.noteEncode(refEventId); // This is a "QUOTE"
      console.clear();
      console.log("##############################################");
      console.log("###               QUOTE A NOTE             ###");
      console.log("##############################################");
    } else if (refEventId !== undefined) {
      eventId = refEventId; // This is a "REPLY"
      console.clear();
      console.log("##############################################");
      console.log("###            REPLY TO A NOTE             ###");
      console.log("##############################################");
    } else {
      console.log("!!! Missing Event ID !!!");
      menu();
    }
  } else if (action !== undefined) {
    console.log("!!! Invalid Action !!!");
    menu();
  } else {
    console.clear();
    console.log("##############################################");
    console.log("###              WRITE A NOTE              ###");
    console.log("##############################################");
  }

  let eventContent = await rl.question('\nEnter your Note Text: ');
  eventContent = eventContent.replace(/\\n/g, '\n')
  if (eventId !== undefined && action === "QUOTE") {
    eventContent += ` nostr:${eventId}`;
  }

  let tagArray = []
  // tag for a reply ["e", eventId]
  if (eventId !== undefined && action === "REPLY") {
    tagArray.push(["e", eventId,"","root"]);
  }
  // const tagArray = JSON.stringify('["e", "'+eventId+'"]'); // for reply ... ?
  // use finalizeEvent from nostr-tools to get the event.id, event.pubkey, event.sig
  const createdAt = Math.floor(Date.now() / 1000);
  const event = finalizeEvent({
    kind: 1,
    created_at: createdAt,
    tags: tagArray,
    content: eventContent,
  }, NSEC)
  // console.log(event);

  if (!verifyEvent(event)) {
    console.log(`\s !!! There was a problem signing your Note !!!`);
    console.log(`!!! Please try again !!!\n`)
    writeNote(refEventId);
  } else {
    console.log(` `);
    console.log(`#######################################`);
    console.log(`#   Your Note is ready to Broadcast   #`);
    console.log(`#######################################`);
    broadcast(event);
  }
}

async function broadcast(event) {
  const eventAction = await rl.question('\n[B]roadcast, [V]iew JSON, [M]ain Menu: ');

  switch(eventAction.charAt(0).toLowerCase()) {
    case "b":
      console.clear();
      console.log(`Broadcasting to relay pool ...`)
      await Promise.any(pool.publish(relays, event));
      console.clear();
      console.log("\x1b[42m", "\x1b[37m")
      console.log(`#################################################`)
      console.log(`#               Congratulations!                #`);
      console.log(`#################################################`)
      console.log(`#            Your Note has Broadcast            #`);
      console.log(`#################################################`)
      let action = await rl.question('[Enter] to Continue');
      // TODO return to feed, if that is where you came from
      console.clear();
      menu();
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
            "tags":[${event.tags}],
            "sig": "${event.sig}"
        }
      ]`;
      console.log(`${eventJson}`); // this is the json output
      broadcast(event);
      break;
    case "m":
      menu();
      break;
    default:
      console.log(`\n!!! Invalid Selection, Try Again !!!\n`);
      broadcast(event);
  }
}

async function help() {
  console.clear();

  console.log(`##################################`);
  console.log(`#       NOSTR-TERMINAL HELP      #`);
  console.log(`##################################\n`);

  console.log(`On the Main Menu:`);
  console.log(`Enter VIEW, V, or F to VIEW FEED of the npub`);
  console.log(`Enter WRITE or W to WRITE a note`);
  console.log(`Enter Q or X to QUIT the program\n`);

  console.log(`On the VIEW FEED screen:`);
  console.log(`The feed will show 1 note at a time`);
  console.log(`The feed will show the 100 most recent notes`);
  console.log(`Press the ENTER button to reveal the next note`);
  console.log(`Enter Q to QUOTE the current note + write your own`);
  console.log(`Enter R to REPLY the current note`);
  console.log(`Enter T to go to the TOP of your feed + see new notes`);
  console.log(`Enter M to return to the Main Menu\n`);

  console.log(`On the WRITE NOTE screen:`);
  console.log(`Enter the text you want in your note`);
  console.log(`You can use \\n to create a line break`);
  console.log(`(example: this has \\n one line break)`);
  console.log(`Press ENTER when you are done with your text`);
  console.log(`You then see the BROADCAST MENU\n`);

  console.log(`On the BROADCAST MENU:`);
  console.log(`Enter V to View the JSON of your event`);
  console.log(`Enter B to Broadcast your event to the network`);
  console.log(`(you will see "Your event has broadcast" + the Main Menu)`);
  console.log(`Enter M to return to the Main Menu\n`);

  console.log(`Contact: npub1nu9m6k6dca28f9humvq0ad334a3czu0qrevw0pd4ml2pzaumx0mqyr3ars\n`)

  // TODO jump back to the previous screen? (Feed, Write, etc?)

  const action = await rl.question('Press [ENTER] to continue: ');
  console.clear();
  menu();

}

function exit() {
  rl.close();
  process.exit(1);
}

function error() {
  console.log(`### Something Went Wrong !!! ###`)
  exit();
}

function bech32Decoder(currPrefix, data) {
  const { prefix, words } = bech32.decode(data);
  if (prefix !== currPrefix) {
      throw Error('Invalid address format');
  }
  return Buffer.from(bech32.fromWords(words));
}
