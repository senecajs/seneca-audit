![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js](http://senecajs.org) plugin

# @seneca/audit

[![npm version](https://img.shields.io/npm/v/@seneca/audit.svg)](https://npmjs.com/package/@seneca/audit)
[![build](https://github.com/senecajs/seneca-audit/actions/workflows/build.yml/badge.svg)](https://github.com/senecajs/seneca-audit/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/senecajs/seneca-audit/badge.svg?branch=main)](https://coveralls.io/github/senecajs/seneca-audit?branch=main)
[![Known Vulnerabilities](https://snyk.io/test/github/senecajs/seneca-audit/badge.svg)](https://snyk.io/test/github/senecajs/seneca-audit)
[![Maintainability](https://api.codeclimate.com/v1/badges/9d54b38a991fe7b92a43/maintainability)](https://codeclimate.com/github/senecajs/seneca-audit/maintainability)

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
|---|---|

Capture message run traces and durations.

## Install

```sh
$ npm install @seneca/audit
```

## Quick Example

```js
const Seneca = require('seneca')

const seneca = Seneca({ legacy: false })
  .use('promisify')
  .use('entity', { mem_store: true })
  .use('audit', {
    // Auditing is off by default; turn it on.
    active: true,

    // Capture selected message properties for matching patterns.
    intercept: {
      'a:1': { include: '*', exclude: [] },
      'b:1': { include: ['b', 'x'], exclude: [] },
    },

    // Called for each intercepted message.
    auditCallback: async function (data) {
      const seneca = this
      await seneca.entity('sys/audit').save$({ msg: { ...data.msg } })
    },
  })

  .message('a:1', async function a1(msg) {
    return { x: 1 + msg.x }
  })

  .message('b:1', async function b1(msg) {
    return this.post('a:1', { x: msg.x })
  })

await seneca.ready()

await seneca.post('a:1', { x: 1 })

// Inspect the captured audit records.
console.log(await seneca.entity('sys/audit').list$())
```

## More Examples

See [test/](test/) for more usage examples.

## Motivation

A [Seneca.js](http://senecajs.org) plugin.

## Support

If you're using this module and need help, you can:

- Post a [github issue](https://github.com/senecajs/seneca-audit/issues)
- Tweet to [@senecajs](http://twitter.com/senecajs)
- Ask on the [Gitter](https://gitter.im/senecajs/seneca)

## API

See [source](https://github.com/senecajs/seneca-audit) for API details.

## Contributing

The [Senecajs org](https://github.com/senecajs/) encourages open participation. If you feel you can help in any way, be it with documentation, examples, extra testing, or new features please get in touch.

### Running tests

```sh
npm run test
```

## Background

Part of the [Senecajs org](https://github.com/senecajs/).
