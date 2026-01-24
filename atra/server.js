require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const templating = require('./server.templating')
const routing = require('./server.routing.js');

const app = express();

templating.useTemplates(app)

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(routing);

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log('listening on http://localhost:'+port);
});


