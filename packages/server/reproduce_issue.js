
const http = require('http');

const body = JSON.stringify({
  "EventTypeId": 1,
  "UserField": "Username",
  "UserValue": "flyingcat2003",
  "ItemField": "ItemTitle",
  "ItemValue": "iPhone 15 Pro Max",
  "Timestamp": "2024-12-25T08:30:00.000Z",
  "TrackingRuleId": 1
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/event',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(body);
req.end();
