/* Copyright © 2024 Richard Rodger, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Seneca from 'seneca'
import type {} from '@seneca/entity'
import SenecaMsgTest from 'seneca-msg-test'

import Audit from '..'
import AuditMessages from './audit.messages'

type AuditRecord = { meta: any; msg: Record<string, any> }

describe('audit', () => {
  test('happy', async () => {
    expect(Audit).exist()

    const seneca = Seneca({ legacy: false }).test().use(Audit)
    await seneca.ready()
  })

  test('messages', async () => {
    const seneca = Seneca({ legacy: false }).test().use(Audit)
    await SenecaMsgTest(seneca, AuditMessages)()
  })

  test('basic', async () => {
    const seneca = Seneca({ legacy: false }).test().use(Audit)
    await seneca.ready()
    expect(seneca.find_plugin('Audit')).exist()
  })

  test('intercept', async () => {
    const records: AuditRecord[] = []

    const seneca = Seneca({ legacy: false })
      .test()
      .use(Audit, {
        active: true,

        auditCallback: function (data: AuditRecord) {
          records.push(data)
        },

        intercept: {
          'c:1': { include: ['c', 'x'], exclude: [] },
          'b:1': { include: ['b', 'x'], exclude: [] },
          'a:1': { include: '*', exclude: ['y'] },
        },
      })

      .message('a:1', async function a1(msg) {
        return { x: 1 + msg.x }
      })

      .message('b:1', async function b1(msg) {
        await this.post('a:1', { x: msg.x })
        return { x: 2 * msg.x }
      })

      .message('c:1', async function c1_0(msg) {
        await this.post('a:1', { x: msg.x })
        await this.post('b:1', { x: msg.x })
        return { x: 0.5 * msg.x }
      })

      // The prior call of c:1 is not recorded.
      .message('c:1', async function c1_1(msg) {
        return this.prior({ ...msg, x: msg.x + 1 })
      })

      .message('d:1', async function d1(msg) {
        return { x: msg.x }
      })

    await seneca.ready()

    expect(await seneca.post('c:1', { x: 2, z: 3 })).equal({ x: 1.5 })

    // Not intercepted.
    expect(await seneca.post('d:1', { x: 4 })).equal({ x: 4 })

    // Include '*' with exclude.
    expect(await seneca.post('a:1', { x: 5, y: 6, w: 7 })).equal({ x: 6 })

    const msgs = records.map((r) => r.msg)
    expect(msgs.length).equal(5)

    // Only the include list is recorded.
    expect(msgs[0]).equal({ c: 1, x: 2 })

    // Calls made inside the prior action are recorded.
    expect(msgs[1].a).equal(1)
    expect(msgs[1].x).equal(3)
    expect(msgs[2]).equal({ b: 1, x: 3 })
    expect(msgs[3].a).equal(1)
    expect(msgs[3].x).equal(3)

    expect(msgs[4].a).equal(1)
    expect(msgs[4].x).equal(5)
    expect(msgs[4].w).equal(7)
    expect(msgs[4].y).not.exist()

    for (const r of records) {
      expect(r.meta.pattern).string()
    }

    expect(seneca.export('Audit/raw')().active).equal(true)
  })

  test('inactive', async () => {
    const records: AuditRecord[] = []

    const seneca = Seneca({ legacy: false })
      .test()
      .use(Audit, {
        auditCallback: function (data: AuditRecord) {
          records.push(data)
        },
        intercept: {
          'a:1': { include: '*' },
        },
      })
      .message('a:1', async function a1(msg) {
        return { x: 1 + msg.x }
      })

    await seneca.ready()

    expect(await seneca.post('a:1', { x: 1 })).equal({ x: 2 })
    expect(records.length).equal(0)
  })

  test('ignore', async () => {
    const records: AuditRecord[] = []

    const seneca = Seneca({ legacy: false })
      .test()
      .use(Audit, {
        active: true,

        // A list of any length, with string and object patterns.
        ignore: ['plugin: define', 'plugin: init', 'a:1,x:2', { a: 1, x: 3 }],

        auditCallback: function (data: AuditRecord) {
          records.push(data)
        },
        intercept: {
          'a:1': { include: ['a', 'x'] },
        },
      })
      .message('a:1', async function a1(msg) {
        return { x: 1 + msg.x }
      })

    await seneca.ready()

    expect(seneca.find_plugin('Audit')?.options.ignore.length).equal(4)

    await seneca.post('a:1', { x: 1 })
    await seneca.post('a:1', { x: 2 })
    await seneca.post('a:1', { x: 3 })
    await seneca.post('a:1', { x: 4 })

    expect(records.map((r) => r.msg)).equal([
      { a: 1, x: 1 },
      { a: 1, x: 4 },
    ])
  })

  test('ignore-default', async () => {
    const seneca = Seneca({ legacy: false }).test().use(Audit)
    await seneca.ready()
    expect(seneca.find_plugin('Audit')?.options.ignore).equal([
      'plugin: define',
      'plugin: init',
    ])

    const s1 = Seneca({ legacy: false }).test().use(Audit, { ignore: [] })
    await s1.ready()
    expect(s1.find_plugin('Audit')?.options.ignore).equal([])
  })

  test('entity', async () => {
    const records: AuditRecord[] = []

    const seneca = Seneca({ legacy: false })
      .test()
      .use('@seneca/entity', { mem_store: true })
      .use(Audit, {
        active: true,
        auditCallback: function (data: AuditRecord) {
          records.push(data)
        },
        intercept: {
          'sys:entity,base:sys,name:item,cmd:save': {
            include: '*',
            exclude: [],
          },
        },
      })

    await seneca.ready()

    await seneca.entity('sys/item').save$({ who: 'alice' })
    await seneca.entity('sys/item').data$({ who: 'bob' }).save$()
    await seneca.entity('sys/other').save$({ who: 'carol' })

    expect(records.length).equal(2)
    expect(records.map((r) => r.msg.ent.data$(false).who)).equal([
      'alice',
      'bob',
    ])
    expect(records[0].msg.ent.canon$({ object: true })).include({
      base: 'sys',
      name: 'item',
    })
  })
})
