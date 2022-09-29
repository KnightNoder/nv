const app = require('./index.js');
const port = process.env.PORT || 2000;
// console.log(process.env)
// Server
app.listen(port, () => {
   console.log(`Listening on: http://localhost:${port}`);
});