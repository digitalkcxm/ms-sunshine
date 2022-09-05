import moment from 'moment'

export async function up(knex) {
  await knex.schema.createTable('messages', (table) => {
    table.increments('id')
    table.integer('protocol_id').notNullable()
    table.string('message_id').unique('message_id').notNullable()
    table.text('content').notNullable()
    table.string('type').notNullable()
    table.string('source').notNullable()
    table.time('received')
    table.timestamps(true, true)
    table.foreign('protocol_id').references('protocols.id')
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220413110220_create_table_messages successful.`)
}

export async function down(knex) {}


