# bolt-internal-checks

Internal Bolt module used for various types of a validations.

## Installation

```sh
$ npm install bolt-internal-checks
```

## Use

```js
var check   = require('bolt-internal-checks')
var express = require('express')

var app = express()
app.post('/admin', check.forAdminRight, function(request, response){ response.send("Yayy, I'm an admin")});
```

### Note

This is an internal module and should not be used in 3rd party apps.