import moment from 'moment'

export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20210916094000_create_extension_uuid successful.`)
}

export async function down(knex) {}
