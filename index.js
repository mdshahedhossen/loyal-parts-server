const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config()
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.semyj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // console.log(authHeader)
    if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    // console.log(token)
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
        const paymentCollection =client.db("loyal-parts").collection("payments")
        const reviewCollection = client.db("loyal-parts").collection("reviews")
        // /verifyadmin function
        const verifyAdmin =async( req,res,next)=>{
            const requester = req.decoded.email;
            const isAdmin = await userCollection.findOne({email:requester});
            if(isAdmin.role === 'admin'){
                next()
            }else{
                return res.status(401).send({message:'Forbidden access'})
            }
        }

        app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
          const service = req.body;
          const price = service.price;
          const amount = price*100;
          const paymentIntent = await stripe.paymentIntents.create({
            amount : amount,
            currency: 'usd',
            payment_method_types:['card']
          });
          res.send({clientSecret: paymentIntent.client_secret})
        });

        app.get('/parts',async(req,res)=>{
            const query={}
            const cursor=partsCollection.find(query)
            const parts = await cursor.toArray();
            res.send(parts);
        });
        

        app.get('/user',verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
          });

          app.get('/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
          });

          app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
              const filter = { email: email };
              const updateDoc = {
                $set: { role: 'admin' },
              };
              const result = await userCollection.updateOne(filter, updateDoc);
              res.send(result);
            }
            else{
              res.status(403).send({message: 'forbidden'});
            }
      
          })
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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' })
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

        //get all orders list for admin
        app.get('/orders',verifyJWT,verifyAdmin, async (req, res) => {
          const query = {}
          const items = await orderCollection.find(query).toArray()
          res.send(items)
      })
      //deleteing product by admin
      app.delete('/deleteparts/:id',verifyJWT,verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = {_id: ObjectId(id)}
        const result = await partsCollection.deleteOne(filter);
        res.send(result)
    });

        app.get('/order',verifyJWT, async(req,res)=>{
            const email=req.query.email
            const query={email:email};
            const order=await orderCollection.find(query).toArray();
            res.send(order);
        });

        //get singel order details for payment
        app.get('/order/:id',verifyJWT, async (req, res) => {
          const id = req.params.id;
          const query = {_id: ObjectId(id)}
          const result = await orderCollection.findOne(query);
          res.send(result)
      });


      //update payment info in order object
      app.patch('/order/:id',verifyJWT, async (req, res) => {
          const id = req.params.id;
          const payment = req.body;
          const filter = {_id: ObjectId(id)}
          const updateDoc = {
              $set:{
                  paid:true,
                  transactionId: payment.transactionId
              }
          }
          const updateOrder = await orderCollection.updateOne(filter,updateDoc);
          const updatePayment = await paymentCollection.insertOne(payment)
          res.send(updateOrder)
      });
        
        //delete order
        app.delete('/cancelorder/:id', async (req, res) => {
            const id= req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
          });
      
          //add review for user
         app.post('/addreview',verifyJWT, async (req, res) => {
          const order = req.body;
          const result = await reviewCollection.insertOne(order);
          res.send({ success: true, result })
      });

      //get all reviews
      app.get('/reviews', async (req, res) => {
        const query = {}
        const items = await reviewCollection.find(query).toArray()
        res.send(items)
    })
      // add new product  
      app.post('/addproduct',verifyJWT,verifyAdmin, async (req, res) => {
        const product = req.body;
        const result = await partsCollection.insertOne(product);
        // console.log(result)
        res.send({ success: true, result })
    });

      // update shiping info
      app.patch('/shipp/:id',verifyJWT,verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = {_id: ObjectId(id)}
        const updateDoc = {
            $set:{
                shippment:true,
            }
        }
        const updateOrder = await orderCollection.updateOne(filter,updateDoc);
        res.send(updateOrder)
    });

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

