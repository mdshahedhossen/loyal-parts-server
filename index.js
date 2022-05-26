const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.semyj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      req.decoded = decoded;
      next();
    });
  }
  
async function run(){
    try{
        await client.connect();
        const partsCollection = client.db("loyal-parts").collection("parts")
        const userCollection = client.db("loyal-parts").collection("users")
        const orderCollection = client.db("loyal-parts").collection("order")

        app.get('/parts',async(req,res)=>{
            const query={}
            const cursor=partsCollection.find(query)
            const parts = await cursor.toArray();
            res.send(parts);
        });
        //----------------user---------------
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
              $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
          })

        app.get('/parts/:id',async(req,res)=>{
            const id=req.params.id
            const query={_id:ObjectId(id)};
            const partsItem=await partsCollection.findOne(query);
            res.send(partsItem)
        });

        app.post('/order',async(req,res)=>{
            const order=req.body;
            const result=await orderCollection.insertOne(order)
            res.send({ success: true, result })
        });

        app.get('/order',async(req,res)=>{
            const email=req.query.email
            const query={email:email};
            const order=await orderCollection.find(query).toArray();
            res.send(order);
        })
        //delete order
        app.delete('/order/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = {email: email};
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
          });
      

        //post
        // app.post('/parts',async(req,res)=>{
        //     const newparts=req.body;
        //     const result=await partsCollection.insertOne(newparts)
        //     res.send(result);

        // });

        // app.get('/order/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = {_id: ObjectId(id)}
        //     const result = await orderCollection.findOne(query);
        //     res.send(result)
        // });

    }
    finally{

    }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('the loyal server is run')
})
app.listen(port, () => {
    console.log(`loyal parts App listening on port ${port}`)
  })

