const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4m2tg.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send({ message: 'Unauthorized access!' });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');


        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            console.log(req.query);
            console.log(date);
            const services = await servicesCollection.find().toArray();

            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            console.log(bookings);

            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                const bookedSlots = serviceBookings.map(book => book.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(services);
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        app.get('/user', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '72h' })
            res.send({ result, token });
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })


    } finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from doctor uncle!')
})

app.listen(port, () => {
    console.log(`doctors app listening on port ${port}`)
})