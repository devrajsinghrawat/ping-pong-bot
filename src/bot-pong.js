const Web3 = require('web3');
const ethTx = require('ethereumjs-tx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { API_KEY, PRIVATE_KEY } = process.env;
let contract;
const contractAddress = '0xa890E28355697aCF0738F5e3EB0f936AD41cF9b5'; // Contract - Ping Pong --> https://rinkeby.etherscan.io/address/0xa890E28355697aCF0738F5e3EB0f936AD41cF9b5
let web3;

async function startApp() {
  if (!contract) {
    let contractAbi = fs.readFileSync(path.resolve('./src/contracts/', 'abi.json'));
    web3 = await new Web3(
      new Web3.providers.WebsocketProvider(
        `wss://rinkeby.infura.io/ws/v3/${API_KEY}`,
      ),
    );
    contractAbi = JSON.parse(contractAbi);
    contract = new web3.eth.Contract(contractAbi, contractAddress);
  }

  let recordedBlockNumber = await lastRecordedBlockNumber();
  console.log('recordedBlockNumber', recordedBlockNumber);
  // So as we had already Pong till recordedBlockNumber so now we have to process the onwards record
  const nextPongBlockNumber = recordedBlockNumber + 1;

  // fetch the last recorded block number
  await contract.events
    .Ping({ fromBlock: nextPongBlockNumber }) //  function(error, event){ console.log('events log'); })
    .on('data', async (event) => {
      try {
        console.log('Tx hash from event', event.blockNumber);
        setTimeout(await postPongTx(event.transactionHash), 360000);   // approx 7 mins
      } catch (error) {
        setTimeout(startApp, 420000);   // 9 mins 
      }
    })
    .on('error', () => {
      setTimeout(startApp, 420000);     // 9 mins 
    });
}

/** Fetch the last recorded block number for Pong event */
const lastRecordedBlockNumber = async () => {
  let blockNumber =  10343798; // it is the 1st Block number (10343798) which had captured the Ping event
  const promisesToAwait = [];

  try {
    await contract.getPastEvents(
      'Pong',
      {
        fromBlock:  blockNumber,
        toBlock: 'latest',
      },
      async (error, logs) => {
        if (error) console.error(error);
        for (let index = 0; index < logs.length; index++) {
          const log = logs[index];
          const txHashFromEventParameter = log.returnValues.txHash;
          // Calculate the Ping event block number from captured txHash
          promisesToAwait.push(fetchDataForIndex(txHashFromEventParameter, blockNumber));
        }
      }
    );

    /**
     * Here we have received all blocknumbers related to the txHash attached to Pong events
     * We need to highest block number among them so that we can continue from next block from the
     * highest captured block for it we ll just add 1 to it so that logic should pick up onwards events
     * */
      const blockNumbers = (await Promise.all(promisesToAwait)); 
      blockNumber = max = Math.max( ...blockNumbers);
      console.log('blockNumber after all promise', blockNumber);
    return blockNumber;
  } catch (error) {
    console.log(error);
  }
};

const fetchDataForIndex = async (txHash, block) => {
  let blocknumber = block;
  await web3.eth.getTransactionReceipt(txHash, (err, tx) => {
    blocknumber = tx.blockNumber > blocknumber ? tx.blockNumber : blocknumber;
  })
  return blocknumber;
}

/** Call Pong function */
const postPongTx = async (txHash) => {
  let sender = await web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  web3.eth.accounts.wallet.add(sender);
  web3.eth.defaultAccount = sender.address;
  // const nonceWithPendingTx = await web3.eth.getTransactionCount(sender.address, 'pending');

  console.log('Calling Pong Function ....');
  await contract.methods
    .pong(txHash)
    .send({
      from: sender.address,
      gas: 800000,
    })
    .on('transactionHash', function (hash) {
      console.log('Transaction Hash: ' + hash);
    })
    .on('confirmation', function (confirmationNumber, receipt) {
      console.log(
        'Confirmation Num: ' + confirmationNumber + ' Receipt: ' + receipt,
      );
    })
    .on('receipt', function (receipt) {
      console.log('Receipt: ' + receipt.toString());
    })
    .on('error', function (err) {
      console.log(err);
    });
};

startApp();
