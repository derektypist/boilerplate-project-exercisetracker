const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
let uri = process.env.MLAB_URI;

mongoose.connect(uri, {useNewUrlParser:true, useUnifiedTopology:true});

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

// Database Schema
let exerciseSessionSchema = new mongoose.Schema({
  description: {type:String, required: true},
  duration: {type:Number, required: true},
  date: String
  
});

let userSchema = new mongoose.Schema({
  username: {type: String, required:true},
  log: [exerciseSessionSchema]
});


let Session = mongoose.model('Session', exerciseSessionSchema);
let User = mongoose.model('User', userSchema);

app.post('/api/exercise/new-user', (request, response) => {
  let newUser = new User({username: request.body.username});
  newUser.save((error, savedUser) => {
    if(!error) {
      let responseObject = {};
      responseObject['username'] = savedUser.username;
      responseObject['_id'] = savedUser.id;
      response.json(responseObject);
    }
  });
});

app.get('/api/exercise/users', (request, response) => {
  User.find((error, arrayOfUsers) => {
    if(!error) {
      response.json(arrayOfUsers);
    }
  });
});

app.post('/api/exercise/add', (request, response) => {
  let newSession = new Session({
    description: request.body.description,
    duration: parseInt(request.body.duration),
    date: request.body.date
  });

  if (newSession.date === '') {
    newSession.date = new Date().toISOString().substring(0,10);
  }

  User.findByIdAndUpdate(request.body.userId, 
  {$push: {log:newSession}},
  {new: true},
  (error, updatedUser) => {
    if(!error) {
      let responseObject = {};
      responseObject['_id'] = updatedUser.id;
      responseObject['username'] = updatedUser.username;
      responseObject['date'] = new Date(newSession.date).toDateString();
      responseObject['description'] = newSession.description;
      responseObject['duration'] = newSession.duration;
      response.json(responseObject);
    }
  });

});

app.get('api/exercise/log', (request, response) => {
  User.findById(request.query.userId, (error, result) => {
    if(!error) {
      let responseObject = result;

      if (request.query.from || request.query.to) {
        let fromDate = new Date(0);
        let toDate = new Date();

        if (request.query.from) {
          fromDate = new Date(request.query.from);
        }

        if (request.query.to) {
          toDate = new Date(request.query.to);
        }

        fromDate = fromDate.getTime();
        toDate = toDate.getTime();

        responseObject.log = responseObject.log.filter((session) => {
          let sessionDate = new Date(session.date).getTime();

          return sessionDate >= fromDate && sessionDate <= toDate;
        });

      }

      if (request.query.limit) {
        responseObject.log = responseObject.log.slice(request.query.limit);
      }

      responseObject = responseObject.toJSON();
      responseObject['count'] = result.log.length;
      response.json(responseObject);

    }
  });
});
