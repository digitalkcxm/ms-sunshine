import moment from 'moment'

export async function up(knex) {
  await knex.schema.createTable('contacts', (table) => {
    table.increments('id')
    table.uuid('settings_id').notNullable()
    table.string('user_id').unique('user_id').notNullable()
    table.string('name').notNullable()
    table.string('email')
    table.string('locale')
    table.string('customer')
    table.string('cpf_cnpj')
    table.string('phone')
    table.string('client')
    table.timestamp('authentications')
    table.integer('count_security')
    table.boolean('client_authentication')
    table.boolean('has_payment_info')
    table.timestamp('signed_up_at')
    table.timestamps(true, true)
    table.foreign('settings_id').references('settings.id')
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220413005623_create_table_contacts successful.`)
}

export async function down(knex) {}
