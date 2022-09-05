import moment from 'moment'

export async function up(knex) {
  await knex.schema.createTable('protocols', (table) => {
    table.increments('id')
    table.uuid('settings_id').notNullable()
    table.string('conversation_id').notNullable()
    table.integer('contact_id').notNullable()
    table.boolean('closed').defaultTo(false)
    table.timestamps(true, true)
    table.foreign('settings_id').references('settings.id')
    table.foreign('contact_id').references('contacts.id')
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220413010445_create_table_protocols successful.`)
}

export async function down(knex) {}
