import 'dotenv/config'

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { SimplePool } from 'nostr-tools/pool'
import { useWebSocketImplementation } from 'nostr-tools/relay'
import { WebSocket } from 'ws'

import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { bech32, bech32m } from 'bech32';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

useWebSocketImplementation(WebSocket);
showMenu();

async function showMenu() {
  console.log(`########################`);
  console.log(`[VIEW / V] View Feed`);
  console.log(`[WRITE / W] Write a Note`);
  console.log(`[EXIT / E] Exit`);

  const rl = readline.createInterface({ input, output });
  const action = await rl.question('Choose Action: ');
  rl.close();

  switch(action.charAt(0).toLowerCase()) {
    case "v":
      runView();
      break;
    case "w":
      runWrite();
      break;
    case "e":
      runExit();
      break;
    default:
      console.log("Default")
      showMenu();
  }
}

async function runView() {
  const pool = new SimplePool()
  let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net']
  // const relay = await Relay.connect('wss://nos.lol/')
  let eventArray = [];

  let sub = pool.subscribeMany([...relays],
    [
  // const sub = relay.subscribe([
      {
        // ids: ['bc12d483d2f366f8c0beffbbdf23c9f98b09bdf1f7edc59f40380266a35a9344'],
        kinds: [3], // kind 3 is the follower list
        limit: 5,
        //authors: ["83f1cb3e36a6e15f8f9b855310b3731bd657640ce11125ea910bbc30bd881157"], // hex
        authors: ["9f0bbd5b4dc7547496fcdb00feb631af638171e01e58e785b5dfd411779b33f6"],
      },
    ], {
    onevent(event) {
      eventArray.push(event) // add each event to eventArray
    },
    oneose() {
      // end of steam
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

      // loop through eventArray and print results
      for(let e of eventArray) {
        // Convert Unix timestamp to milliseconds
        let date = new Date(e.created_at * 1000);

        // Extract day, month, year, hour, and minute
        // let day = date.getUTCDate(); // Day of the month (1-31)
        // let month = date.getUTCMonth() + 1; // Month (0-11, so add 1)
        // let year = date.getUTCFullYear(); // Full year
        // let hour = date.getUTCHours(); // Hour (0-23)
        // let minute = date.getUTCMinutes(); // Minute (0-59)

        let formattedDate = new Intl.DateTimeFormat('en-US', dateFormat).format(date);

        // Output the result
        console.log(`${formattedDate} | ${e.content}`)
      }
      sub.close()
      showMenu()
    }
  })

}

async function runWrite() {
  // console.log("runWrite");
  const rl = readline.createInterface({ input, output });
  // let nsec = await rl.question('Enter your nsec -or- press [enter] for .env: ');
  const eventContent = await rl.question('Enter your Note Text: ');
  rl.close();

  let nsec = process.env.NSEC;
  nsec = (nsec.slice(0,4) !== "nsec") ? "nsec" + nsec : nsec;
  // console.log(`NSEC: ${nsec}`)

  const nsecDecoded = bech32Decoder('nsec', nsec);
  let nsecHex = bytesToHex(nsecDecoded);
  // console.log(`Private Hex: ${nsecHex}`)
  // let pubHex = getPublicKey(nsecHex);
  // console.log(`Public Hex: ${pubHex}`)

  // use finalizeEvent from nostr-tools to get the event.id, event.pubkey, event.sig
  const createdAt = Math.floor(Date.now() / 1000);
  const event = finalizeEvent({
    kind: 1,
    created_at: createdAt,
    tags: [],
    content: eventContent,
  }, nsecHex)


  if (!verifyEvent(event)) {
    runError();
  } else {
    // create the JSON for the EVENT that will be broadcast
    const eventJson = `[
      "EVENT",
      {
          "id": "${event.id}",
          "pubkey": "${event.pubkey}",
          "created_at": ${createdAt},
          "kind": 1,
          "content": "${eventContent}",
          "tags": [],
          "sig": "${event.sig}"
      }
    ]`;

    console.log(`Your event is ready to broadcast.`);

    runWriteBroadcast(eventJson);
  }
}

async function runWriteBroadcast(eventJson) {
  const rl = readline.createInterface({ input, output });
  // let nsec = await rl.question('Enter your nsec -or- press [enter] for .env: ');
  const eventAction = await rl.question('[B]roadcast, [V]iew JSON, [M]ain Menu: ');
  rl.close();

  switch(eventAction.charAt(0).toLowerCase()) {
    case "b":
      console.log(`### Broadcasting ... `);
      break;
    case "v":
      console.log(`${eventJson}`);
      runWriteBroadcast(eventJson);
      break;
    case "m":
      showMenu();
      break;
    default:
      console.log(`! Invalid Option, Try Again`);
      runWriteBroadcast();
  }
}

function runExit() {
  console.log("runExit");
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
