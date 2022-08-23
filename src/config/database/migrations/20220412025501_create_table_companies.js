import moment from 'moment'

export async function up(knex) {
    await knex.schema.createTable('companies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.string('ms_company_id', 32).notNullable().unique('ms_company_id')
    table.timestamps(true, true)
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220412025501_create_table_companies successful.`)
}

export async function down(knex) {}
