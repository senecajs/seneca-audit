/* Copyright © 2024 Richard Rodger, MIT License. */

import type Seneca from 'seneca'

// TODO: separate out errored messages

type Options = {
  debug: boolean
  active: boolean
  ignore: Array<any>
  intercept: any
  auditCallback: any
}

// Messages that are not audited, unless the ignore option replaces them.
const defaultIgnore = ['plugin: define', 'plugin: init']

function noAuditCallback() {}

// Default options, built with the validator that Seneca passes in.
const defaults = ({ valid }: { valid: Seneca.Instance['valid'] }) => ({
  debug: false,
  active: false,

  // Patterns, as strings or objects. A list that you pass replaces the
  // default list.
  ignore: valid.Default([...defaultIgnore], [valid.Any()]),

  intercept: {},
  auditCallback: function auditCallback() {},
})

export type AuditOptions = Partial<Options>

function preload(this: any, plugin: any) {
  const seneca = this
  const root = seneca.root
  const options: AuditOptions = plugin.options
  const auditCallback = (options.auditCallback || noAuditCallback).bind(seneca)
  const ignore = options.ignore || defaultIgnore
  const intercept = options.intercept || {}

  const Patrun = seneca.util.Patrun
  const Jsonic = seneca.util.Jsonic
  const ignored = new Patrun({ gex: true })
  const intercepted = new Patrun({ gex: true })

  const tdata = (root.context.$_sys_Audit ??= {
    active: options.active,
    msg: {},
    trace: {},
    runs: {},
  })

  /*
  // test
  async function auditCallback(this: any, msg: any) {
    // console.log('record Callback message: ', msg)
    await seneca.entity('sys/audit').save$({ msg, })
  }
  */

  for (let ig of ignore) {
    ignored.add('string' == typeof ig ? Jsonic(ig) : ig, 1)
  }

  for (let st in intercept) {
    // transform for optimization
    if (intercept[st].include && '*' === intercept[st].include) {
      intercept[st].include = '*'
    } else {
      intercept[st].include = (intercept[st].include || []).reduce(
        (acc: any, v: any) => ((acc[v] = true), acc),
        {},
      )
    }

    intercept[st].exclude = (intercept[st].exclude || []).reduce(
      (acc: any, v: any) => ((acc[v] = true), acc),
      {},
    )

    intercepted.add('string' == typeof st ? Jsonic(st) : st, intercept[st])
  }

  root.order.inward.add(
    (spec: any) => {
      if (!tdata.active) return null

      const actdef = spec.ctx.actdef
      const meta = spec.data.meta
      const msg = spec.data.msg

      if (
        (actdef && 'Audit' == actdef.plugin_name) ||
        (msg && 0 != ignored.length && ignored.find(msg))
      ) {
        return
      }

      // console.log('IN: ', msg, spec.data.meta.prior)

      if (actdef) {
        const when = Date.now()

        const pat = actdef.pattern
        const act = actdef.id

        let properties

        // console.log('IN', pat, actdef, meta)

        // TODO: Do we capture prior as well?
        if ((properties = intercepted.find(msg)) && null == meta.prior) {
          let reducedMsg = {}
          // console.log( properties, msg )

          const { include, exclude } = properties
          reducedMsg = Object.entries(msg).reduce((acc: any, pair: any) => {
            const [key, value] = pair

            if ('*' === include) {
              // TODO: case for ( !key.endsWith('$') )
              if (null == exclude[key]) {
                acc[key] = value
              }
            } else if (null != include[key] && null == exclude[key]) {
              acc[key] = value
            }
            return acc
          }, {})

          // console.log(reducedMsg)

          auditCallback({ meta, msg: reducedMsg })
        }
      }
    },
    { after: 'announce' },
  )

  /*
  root.order.outward.add((spec: any) => {
    if (!tdata.active) return null

    const actdef = spec.ctx.actdef
    const meta = spec.data.meta
    if (actdef) {
    
    console.log('outward actdef: ', actdef.plugin_name)
    
    
      const when = Date.now()

      // console.log('OUT', actdef.pattern)
      const pat = actdef.pattern
      const act = actdef.id
    }
  }, { before: 'make_error' })
  */
}

function Audit(this: any, _options: Options) {
  let seneca: any = this
  const root: any = seneca.root

  const tdata = root.context.$_sys_Audit

  seneca.fix('sys:audit')

  /*
    .message('set:record', async function setRecord(this: any, msg: any) {
      
    })
    */

  return {
    exports: {
      raw: () => tdata,
    },
  }
}

Object.assign(Audit, { defaults, preload })

// Prevent name mangling
Object.defineProperty(Audit, 'name', { value: 'Audit' })

export default Audit

if ('undefined' !== typeof module) {
  module.exports = Audit
}
