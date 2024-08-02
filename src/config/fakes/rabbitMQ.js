// __mocks__/rabbitMQ.js

const mockChannel = {
    assertQueue: jest.fn().mockImplementation((queue, options, callback) => {
        callback(null, { queue: queue });
    }),
    prefetch: jest.fn(),
    consume: jest.fn().mockImplementation((queue, callback, options, consumeCallback) => {
        consumeCallback(null, { consumerTag: 'mockConsumerTag' });
    }),
    sendToQueue: jest.fn(),
    checkQueue: jest.fn().mockImplementation((queue, callback) => {
        callback(null, { consumerCount: 1 });
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    cancel: jest.fn(),
};

const mockConnection = {
    createChannel: jest.fn().mockImplementation((callback) => {
        callback(null, mockChannel);
    }),
    close: jest.fn().mockImplementation((callback) => {
        callback();
    }),
    on: jest.fn(),
};

const queue = jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
        global.amqpConn = mockChannel;
        resolve(mockChannel);
    });
});

const closeConnection = jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
        global.amqpConn = null;
        resolve();
    });
});

export { mockChannel, mockConnection };
export { closeConnection };
export default queue;