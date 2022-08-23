import moment from 'moment'

export async function up(knex) {
    await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('company_id').notNullable()
    table.string('name').unique('name').notNullable()
    table.string('appID').notNullable()
    table.string('username').notNullable()
    table.string('password').notNullable()
    table.boolean('activated').defaultTo(true).notNullable()
    table.timestamps(true, true)
    table.foreign('company_id').references('companies.id')
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220412025531_create_table_settings successful.`)
}

export async function down(knex) {}
