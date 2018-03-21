'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const { User } = require('./models');
const { Question } = require('../questions/models');
const router = express.Router();
const jsonParser = bodyParser.json();
const { helpers, questionQueue, setQuestions } = require('../questions');

//Register new users

router.get('/allUsers', (req, res) => {
  return User.find()
    .then(allUsers => {
      res.json(allUsers);
    });
});

router.post('/', jsonParser, (req, res) => {
  console.log("hey");
  const requiredFields = ['username', 'password'];
  const missingField = requiredFields.find(field => !(field in req.body));
  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Missing field',
      location: missingField
    });
  }

  const stringFields = ['username', 'password'];
  const nonStringField = stringFields.find(field => field in req.body && typeof req.body[field] !== 'string');
  if (nonStringField) {
    return res.status(422).json({
      code: 422, 
      reason: 'ValidationError', 
      message: 'Expected string', 
      location: nonStringField
    });
  }

  const trimmedFields = ['username', 'password'];
  const nonTrimmedField = trimmedFields.find(field => req.body[field].trim() !== req.body[field]);
  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422, 
      reason: 'ValidationError',
      message: 'Cannot start or end with whitespace', 
      location: nonTrimmedField
    });
  }
  
  const sizedFields = {
    username: {min: 1}, 
    password: {min: 7, max: 72}
  };

  const tooSmallField = Object.keys(sizedFields).find(
    field => 'min' in sizedFields[field] && req.body[field].trim().length < sizedFields[field].min
  );

  const tooLargeField = Object.keys(sizedFields).find(
    field => 'max' in sizedFields[field] && req.body[field].trim().length > sizedFields[field].max
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: tooSmallField ? `Must be at least ${sizedFields[tooSmallField].min} characters long` :
        `Must be at most ${sizedFields[tooLargeField].max} characters long`,
      location: tooSmallField || tooLargeField
    });
  }

  let { username, password } = req.body;

  return User.find({username})
    .count()
    .then(count => {
      if (count > 0) {
        return Promise.reject({
          code: 422,
          reason: 'ValidationError',
          message: 'Username already taken',
          location: 'username'
        });
      }
      return User.hashPassword(password);
    })
    .then(hash => {
      return new User({
        username,
        password: hash
      });
    })
    .then(user => Question.find().then(questions => ({user, questions})))
    .then(({user, questions}) => {
      user.performance = questions.map((question, index) => ({
        word: question.question,
        answer: question.answer
      }));
      return user.save();
    })
    .then(user => {
      //send back a safe representation of the user (no passwords)
      return res.status(201).location(`/api/users/${user.id}`).json(user.apiRepr());
    })
    .catch(err => {
      if (err.reason === 'ValidationError') {
        return res.status(err.code).json(err);
      }
      res.status(500).json({code: 500, message: 'Something went wrong'});
    });
});


module.exports = {router};