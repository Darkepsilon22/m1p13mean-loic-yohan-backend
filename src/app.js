const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API Centre Commercial marche' });
});

const routes = require('./routes');
app.use('/api', routes);



module.exports = app;
