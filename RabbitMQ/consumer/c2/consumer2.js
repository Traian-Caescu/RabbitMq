const express = require('express')
const app = express()
const amqp = require('amqplib') // Documentation here: https://www.npmjs.com/package/amqp

const APP_CONSUMER2_PORT = 3002
const RMQ_CONSUMER2_PORT = 5672
const QUEUE_NAME = process.env.QUEUE_NAME || 'computer'  // Set in compose to change queue name
const RMQ_USER_NAME = 'admin'
const RMQ_PASSWORD =  'admin'
//const RMQ_HOST = '20.108.32.75'  // Private IP of the vm hosting rabbitmq
const RMQ_HOST = 'localhost'   // If accessing local mq container
//const RMQ_HOST = 'host.docker.internal'
//const RMQ_HOST = '10.1.0.4'

app.get("/", (req, res) => {
  res.send(`Consumer 2 is up`)
})

// No http endpoints. Only using server to support the backend consumer app
const server = app.listen(APP_CONSUMER2_PORT, () => console.log(`Listening on port ${APP_CONSUMER2_PORT}`))

// Function connects to a queue and registers a callback which will run continuously
// Each time a message lands on the queue, the callback is called. Could for example, 
// just move messages straight into a database
async function getMessages(channel, queue) {
  try {
    await channel.assertQueue(queue, { durable: true })  // Connect to a durable queue or create if not there

    // Create callback that will listen for queued message availability
    channel.consume(queue, message => {
      let msg = JSON.parse(message.content.toString()) // Convert message to string then json -> msg
      console.log(msg)     // Just output or, say write to a file, database or whatever
      channel.ack(message) // Ack message so it will be removed from the queue
    })
  } catch (err) {
    throw err
  }
}

// Create connection and channel and return them to the caller
async function createConnection(conStr) {
  try {
    const connection = await amqp.connect(conStr)    // Create connection
    console.log(`Connected to Rabbitmq cluster`)

    const channel = await connection.createChannel()    // Create channel. Channel can have multiple queues
    console.log(`Channel created. Will connect to queue: ${QUEUE_NAME}`)

    return { connection, channel }

  } catch (err) {
    console.log(`Failed to connect to RabbitMQ`)
    throw err
  }
}



// This is a very simple consumer for the tv queue. Run it once and it will consume any messages in the queue
// You need to acknowledge receipt for it to be deleted
// Demo shows how you can look for specific queue and even specific messages - other apps may be looking for others
(async () => {

 // const conStr = `amqp://${RMQ_USER_NAME}:${RMQ_PASSWORD}@${RMQ_HOST}:${RMQ_CONSUMER2_PORT}/`
 // Alternatively, create connection with an object to provide settings other than default

 const conStr = {
  hostname: RMQ_HOST,
  port: RMQ_CONSUMER2_PORT,
  username: RMQ_USER_NAME,
  password: RMQ_PASSWORD,
  vhost: '/',
  reconnect: true, // Enable automatic reconnection
  reconnectBackoffStrategy: 'linear', // or 'exponential'
}

  try {
    const rmq = await createConnection(conStr) // amqplib is promise based so need to initialise it in a function as await only works in an async function
    console.log(`Connection created using: ${conStr}`)
    connection = rmq.connection  // Available if needed for something
    channel = rmq.channel
    console.log(`Channel opened on Consumer2`)
    getMessages(channel, QUEUE_NAME) // Call to start the consumer callback
  }
  catch (err) {
    console.log(`General error: ${err}`)
    throw err
  }
})().catch((err) => { 
  console.log(`Shutting down node server listening on port ${APP_CONSUMER2_PORT}`)
  server.close() // Close the http server created with app.listen
  console.log(`Closing app with process.exit(1)`)
  process.exit(1)  // Exit process with an error to force the container to stop
}) // () means call it now

