import express from 'express';
import cors from 'cors';
import { DataAPIClient  } from '@datastax/astra-db-ts';
import dotenv from 'dotenv';
import { verify } from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const AstraClient = new DataAPIClient(process.env['ASTRADB_TOKEN']);
const AstraDB = AstraClient.db(process.env['ASTRADB_ENDPOINT'], {keyspace: "default"});
const Peers = AstraDB.collection("peers");

app.post('/announce', async (req, res) => {
  try {
    const {userid, ip, port, publicKey, signature} = req.body;
    if (!userid || !ip || !port /* || !publicKey || !signature */) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    /*
    const canonical = Buffer.from(JSON.stringify({ userid, ip, port }));

    const valid = verify(
      null,
      canonical,
      publicKey,
      Buffer.from(signature, 'base64'),
    );

    if (!valid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    */
    const existingPeer = await Peers.findOne({ userid });
    if (existingPeer) {
      await Peers.updateOne({ userid }, { $set: { ip, port, /*publicKey,*/ timestamp: new Date() } });
    }
    else {
      await Peers.insertOne({ userid, ip, port, /*publicKey,*/ timestamp: new Date() });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error occurred while processing announce request:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/peers', async (req, res) => {
  try {
    const peers = await Peers.find({}).toArray();
    res.json(peers);
  } catch (error) {
    console.error('Error occurred while fetching peers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }

});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*name', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

setInterval(() => {
    fetch(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health`)
        .catch(() => {}); // silence errors if server is briefly down
}, 14 * 60 * 1000);

setInterval(() => {
  Peers.deleteMany({ timestamp: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
}, 24 * 60 * 60 * 1000);

setInterval(() => {
  Peers.countDocuments({},1000);
}, 47 * 60 * 60 * 1000);