import { jest } from '@jest/globals';
import MessageController from './MessagesController.js';


// Mocks
jest.mock('../helpers/File.js');
jest.mock('../services/CoreService.js');
jest.mock('../services/SunshineService.js');
jest.mock('../models/MessagesModel.js');
jest.mock('../models/ContactsModel.js');
jest.mock('../models/SettingsModel.js');
jest.mock('../models/ProtocolsModel.js');
jest.mock('../models/CompaniesModel.js');
jest.mock('../services/StorageService.js');
jest.mock('../services/MSCompanyService.js');

// Mock got
jest.mock('got', () => {
  return {
    default: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
    })),
  };
});

// Mock file-type
jest.mock('file-type', () => {
  return {
    default: jest.fn(() => ({
      fromBuffer: jest.fn(),
    })),
  };
});

// Mock rabbitMQ
let mockConnection = null;

global.amqpConn = {
  sendToQueue: jest.fn(),
  assertQueue: jest.fn().mockImplementation((queueName, options, callback) => {
    if (callback) callback(null, {});
    return Promise.resolve({});
  }),
  prefetch: jest.fn(),
  consume: jest.fn().mockImplementation((queueName, callback, options, consumeCallback) => {
    if (consumeCallback) consumeCallback(null, { consumerTag: 'mockTag' });
  }),
  checkQueue: jest.fn().mockImplementation((queueName, callback) => {
    if (callback) callback(null, { consumerCount: 1 });
  }),
  ack: jest.fn(),
  nack: jest.fn(),
  cancel: jest.fn(),
  close: jest.fn().mockImplementation((callback) => {
    if (callback) callback(null);
    return Promise.resolve();
  })
};
jest.mock('../config/rabbitMQ.js', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(global.amqpConn),
  closeConnection: jest.fn().mockImplementation(() => {
    return Promise.resolve();
  }),
}));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Espera por operações assíncronas pendentes
  jest.useRealTimers();
  jest.clearAllTimers();
  if (global.amqpConn && global.amqpConn.close) {
    await global.amqpConn.close();
  }
});

const rabbitMQMock = jest.requireMock('../config/rabbitMQ.js');

describe('MessageController', () => {
  let messageController;
  let mockDatabase;

  beforeEach(() => { 
    mockConnection = {};
    global.amqpConn = mockConnection;
    mockDatabase = {};
    messageController = new MessageController(mockDatabase);
    
    global.amqpConn = {
      sendToQueue: jest.fn(),
      assertQueue: jest.fn().mockImplementation((queueName, options, callback) => {
        if (callback) callback(null, {});
        return Promise.resolve({});
      }),
      prefetch: jest.fn(),
      consume: jest.fn().mockImplementation((queueName, callback, options, consumeCallback) => {
        if (consumeCallback) consumeCallback(null, { consumerTag: 'mockTag' });
      }),
      checkQueue: jest.fn().mockImplementation((queueName, callback) => {
        if (callback) callback(null, { consumerCount: 1 });
      }),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn(),
      close: jest.fn().mockImplementation((callback) => {
        if (callback) callback(null);
        return Promise.resolve();
      })
    };

    if (messageController.msCompanyService && messageController.msCompanyService.getByID) {
      jest.spyOn(messageController.msCompanyService, 'getByID').mockResolvedValue({ data: { id: 'mockCompanyId' } });
    }
  });

  afterEach(() => {
    messageController.stopAllMonitoring();
    jest.clearAllMocks();
  });
  afterAll(done => {
    // Limpe todos os timers pendentes
    jest.useRealTimers();
    jest.clearAllTimers();
  
    // Feche todas as conexões pendentes
    if (global.amqpConn && global.amqpConn.close) {
      global.amqpConn.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  test('should initialize correctly', () => {
    expect(messageController).toBeDefined();
    expect(messageController.file).toBeDefined();
    expect(messageController.coreService).toBeDefined();
    expect(messageController.sunshineService).toBeDefined();
    expect(messageController.storageService).toBeDefined();
    expect(messageController.msCompanyService).toBeDefined();
    expect(messageController.messageModel).toBeDefined();
    expect(messageController.contactsModel).toBeDefined();
    expect(messageController.protocolModel).toBeDefined();
    expect(messageController.settingsModel).toBeDefined();
    expect(messageController.companiesModel).toBeDefined();
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      const initializeSpy = jest.spyOn(messageController, 'initialize');
      const setupRetryQueueSpy = jest.spyOn(messageController, 'setupRetryQueue').mockResolvedValue();
      const incomingFromCoreSpy = jest.spyOn(messageController, 'incomingFromCore').mockResolvedValue();

      await messageController.initialize();

      expect(initializeSpy).toHaveBeenCalled();
      expect(setupRetryQueueSpy).toHaveBeenCalled();
      expect(incomingFromCoreSpy).toHaveBeenCalled();
      expect(messageController.connectionCheckInterval).toBeDefined();
    });

    test('should handle initialization error', async () => {
      jest.spyOn(global, 'setInterval').mockImplementation(() => {});
      jest.spyOn(messageController, 'setupRetryQueue').mockRejectedValue(new Error('Setup error'));

      await expect(messageController.initialize()).rejects.toThrow('Setup error');
    });
  });

  describe('incomingFromSunshine', () => {
    test('should process text message correctly', async () => {
      const mockSettings = { company_id: '123', id: 'settingId' };
      const mockProtocol = [{ id: 'protocolId' }];
      const mockMessage = {
        content: { type: 'text', text: 'Hello' },
        source: { type: 'user' }
      };

      messageController.companiesModel.getByID = jest.fn().mockResolvedValue([{ ms_company_id: 'companyId' }]);
      messageController._saveMessage = jest.fn().mockResolvedValue([{ protocol_id: 'protocolId', content: 'Hello', type: 'text' }]);

      const result = await messageController.incomingFromSunshine(mockSettings, mockProtocol, mockMessage);

      expect(result).toBe(true);
      expect(global.amqpConn.sendToQueue).toHaveBeenCalled();
    });

    test('should process non-text message correctly', async () => {
      const mockSettings = { company_id: '123', id: 'settingId' };
      const mockProtocol = [{ id: 'protocolId' }];
      const mockMessage = {
        content: { type: 'image', mediaUrl: 'http://example.com/image.jpg', mediaType: 'image/jpeg', altText: 'An image' },
        source: { type: 'user' }
      };

      messageController.companiesModel.getByID = jest.fn().mockResolvedValue([{ ms_company_id: 'companyId' }]);
      messageController._saveMessage = jest.fn().mockResolvedValue([{ protocol_id: 'protocolId', content: JSON.stringify([{ url: 'http://example.com/image.jpg', type: 'image/jpeg', name: 'An image' }]), type: 'image' }]);

      const result = await messageController.incomingFromSunshine(mockSettings, mockProtocol, mockMessage);

      expect(result).toBe(true);
      expect(global.amqpConn.sendToQueue).toHaveBeenCalled();
    });
  });

  describe('incomingFromCore', () => {
    test('should set up message consumption correctly', async () => {
      await messageController.incomingFromCore();

      expect(global.amqpConn.assertQueue).toHaveBeenCalled();
      expect(global.amqpConn.prefetch).toHaveBeenCalled();
      expect(global.amqpConn.consume).toHaveBeenCalled();
      expect(messageController.consumerConfigured).toBe(true);
      expect(messageController.consumerTag).toBe('mockTag');
    });
  });

  describe('send', () => {
    test('should send a text message successfully', async () => {
      const mockMsg = {
        token: 'token123',
        protocol_id: 'protocolId',
        message: { type: 'text', message: 'Hello' }
      };

      messageController.companiesModel.getByCompanyID = jest.fn().mockResolvedValue([{ id: 'companyId' }]);
      messageController.settingsModel.getByCompanyID = jest.fn().mockResolvedValue([{}]);
      messageController.protocolModel.getByID = jest.fn().mockResolvedValue([{ conversation_id: 'convId' }]);
      messageController.sunshineService.sendMessage = jest.fn().mockResolvedValue({ status: 201, data: { messages: [{}] } });
      messageController._saveMessage = jest.fn().mockResolvedValue({});

      const result = await messageController.send(mockMsg);

      expect(result).toEqual({ message: 'Mensagem enviada com sucesso!' });
    });

    test('should handle invalid company', async () => {
      const mockMsg = {
        token: 'invalidToken',
        protocol_id: 'protocolId',
        message: { type: 'text', message: 'Hello' }
      };

      messageController.companiesModel.getByCompanyID = jest.fn().mockResolvedValue([]);

      const result = await messageController.send(mockMsg);

      expect(result).toEqual({ error: 'Company inválida' });
    });
  });

  describe('setupRetryQueue', () => {
    test('should set up retry queue correctly', async () => {
      await messageController.setupRetryQueue();
      expect(global.amqpConn.assertQueue).toHaveBeenCalledWith(
        'mssunshine_input_retry',
        expect.objectContaining({
          durable: true,
          deadLetterExchange: '',
          deadLetterRoutingKey: 'mssunshine_input',
          messageTtl: 10000
        })
      );
    });
  });

  describe('processMessageWithRetry', () => {
    test('should process message successfully on first attempt', async () => {
      const mockContent = { id: 'testId', message: 'Test message' };
      const mockMsg = { properties: { messageId: 'testMsgId' }, content: Buffer.from(JSON.stringify(mockContent)) };

      messageController.processMessage = jest.fn().mockResolvedValue();

      await messageController.processMessageWithRetry(mockContent, mockMsg);

      expect(messageController.processMessage).toHaveBeenCalledWith(mockContent);
      expect(global.amqpConn.ack).toHaveBeenCalledWith(mockMsg);
    });

    test('should retry message processing up to 3 times', async () => {
      const mockContent = { id: 'testId', message: 'Test message' };
      const mockMsg = { 
        properties: { 
          messageId: 'testMsgId',
          headers: { 'x-retry-count': 0 }
        }, 
        content: Buffer.from(JSON.stringify(mockContent)) 
      };
    
      messageController.processMessage = jest.fn().mockRejectedValue(new Error('Test error'));
    
      await messageController.processMessageWithRetry(mockContent, mockMsg);
      await messageController.processMessageWithRetry(mockContent, { ...mockMsg, properties: { ...mockMsg.properties, headers: { 'x-retry-count': 1 } } });
      await messageController.processMessageWithRetry(mockContent, { ...mockMsg, properties: { ...mockMsg.properties, headers: { 'x-retry-count': 2 } } });
    
      expect(messageController.processMessage).toHaveBeenCalledTimes(3);
      expect(global.amqpConn.sendToQueue).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleMessageError', () => {
    test('should handle recoverable error', () => {
      const mockError = new Error('Recoverable error');
      const mockMsg = { 
        properties: { messageId: 'testMsgId', headers: { 'x-retry-count': 0 } },
        content: Buffer.from('Test message') 
      };

      messageController.isRecoverableError = jest.fn().mockReturnValue(true);

      messageController.handleMessageError(mockError, mockMsg);

      expect(global.amqpConn.sendToQueue).toHaveBeenCalledWith('mssunshine_input_retry', mockMsg.content, expect.any(Object));
      expect(global.amqpConn.ack).toHaveBeenCalledWith(mockMsg);
    });

    test('should handle non-recoverable error', () => {
      const mockError = new Error('Non-recoverable error');
      const mockMsg = { 
        properties: { messageId: 'testMsgId', headers: {} },
        content: Buffer.from('Test message') 
      };
    
      messageController.isRecoverableError = jest.fn().mockReturnValue(false);
    
      messageController.handleMessageError(mockError, mockMsg);
    
      expect(global.amqpConn.nack).toHaveBeenCalledWith(mockMsg, false, false);
    });
  });

  describe('_saveMessage', () => {
    test('should save text message correctly', async () => {
      const mockProtocol = 'protocolId';
      const mockMessage = {
        id: 'messageId',
        content: { type: 'text', text: 'Hello' },
        source: { type: 'user' }
      };

      messageController.messageModel.create = jest.fn().mockResolvedValue([{ id: 'savedMessageId' }]);

      const result = await messageController._saveMessage(mockProtocol, mockMessage);

      expect(messageController.messageModel.create).toHaveBeenCalledWith({
        protocol_id: mockProtocol,
        message_id: mockMessage.id,
        content: 'Hello',
        type: 'text',
        source: 'user'
      });
      expect(result).toEqual([{ id: 'savedMessageId' }]);
    });

    test('should save non-text message correctly', async () => {
      const mockProtocol = 'protocolId';
      const mockMessage = {
        id: 'messageId',
        content: { type: 'image', mediaUrl: 'http://example.com/image.jpg', mediaType: 'image/jpeg', altText: 'An image' },
        source: { type: 'user' }
      };

      messageController.messageModel.create = jest.fn().mockResolvedValue([{ id: 'savedMessageId' }]);

      const result = await messageController._saveMessage(mockProtocol, mockMessage);

      expect(messageController.messageModel.create).toHaveBeenCalledWith({
        protocol_id: mockProtocol,
        message_id: mockMessage.id,
        content: JSON.stringify([{ url: 'http://example.com/image.jpg', type: 'image/jpeg', name: 'An image' }]),
        type: 'image',
        source: 'user'
      });
      expect(result).toEqual([{ id: 'savedMessageId' }]);
    });
  });

  describe('monitorConsumers', () => {
    test('should start monitoring consumers', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((cb) => {
        cb(); // Execute o callback imediatamente
        return 123; // Retorne um ID de intervalo fictício
      });
  
      messageController.monitorConsumers('testQueue');
  
      expect(messageController.monitorInterval).toBeDefined();
      expect(setIntervalSpy).toHaveBeenCalled();
  
      setIntervalSpy.mockRestore();
    });
  
    test('should not start monitoring if already active', () => {
      messageController.monitorInterval = 123;
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
  
      messageController.monitorConsumers('testQueue');
  
      expect(setIntervalSpy).not.toHaveBeenCalled();
  
      setIntervalSpy.mockRestore();
    });
  });
  

  describe('stopMonitoring', () => {
    test('should stop all monitoring', () => {
      const mockMonitorInterval = 123;
      const mockConnectionCheckInterval = 456;
      messageController.monitorInterval = mockMonitorInterval;
      messageController.connectionCheckInterval = mockConnectionCheckInterval;
      jest.spyOn(global, 'clearInterval');
    
      messageController.stopAllMonitoring();
    
      expect(global.clearInterval).toHaveBeenCalledTimes(2);
      expect(global.clearInterval).toHaveBeenCalledWith(mockMonitorInterval);
      expect(global.clearInterval).toHaveBeenCalledWith(mockConnectionCheckInterval);
      expect(messageController.monitorInterval).toBeNull();
      expect(messageController.connectionCheckInterval).toBeNull();
    });
  });

  describe('checkRabbitMQConnection', () => {
    test('should check connection successfully', () => {
      messageController.checkRabbitMQConnection();

      expect(global.amqpConn.checkQueue).toHaveBeenCalledWith('mssunshine_input', expect.any(Function));
    });

    test('should attempt reconnection on error', () => {
      global.amqpConn.checkQueue = jest.fn().mockImplementation((queueName, callback) => {
        callback(new Error('Connection error'));
      });

      const reconnectSpy = jest.spyOn(messageController, 'reconnectRabbitMQ').mockImplementation(() => {});

      messageController.checkRabbitMQConnection();

      expect(reconnectSpy).toHaveBeenCalled();
    });
  });

  describe('reconnectRabbitMQ', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockConnection = {};
      global.amqpConn = mockConnection;
    });
  
    test('should reconnect successfully', async () => {
      rabbitMQMock.default.mockResolvedValue();
      const incomingFromCoreSpy = jest.spyOn(messageController, 'incomingFromCore').mockResolvedValue();
  
      await messageController.reconnectRabbitMQ();
  
      expect(incomingFromCoreSpy).toHaveBeenCalled();
      expect(messageController.consumerConfigured).toBe(false);
      expect(global.amqpConn).not.toBeNull(); // A nova conexão deve ter sido estabelecida
    });
  });
  describe('cancelExtraConsumers', () => {
    test('should cancel extra consumers', () => {
      messageController.consumerTag = 'testTag';

      messageController.cancelExtraConsumers('testQueue', 3);

      expect(global.amqpConn.cancel).toHaveBeenCalledTimes(2);
      expect(global.amqpConn.cancel).toHaveBeenCalledWith('testTag', expect.any(Function));
    });

    test('should not cancel consumers if consumerTag is not set', () => {
      messageController.consumerTag = null;

      messageController.cancelExtraConsumers('testQueue', 3);

      expect(global.amqpConn.cancel).not.toHaveBeenCalled();
    });
  });

  describe('stopAllMonitoring', () => {
    test('should stop all monitoring', () => {
      const mockMonitorInterval = 123;
      const mockConnectionCheckInterval = 456;
      messageController.monitorInterval = mockMonitorInterval;
      messageController.connectionCheckInterval = mockConnectionCheckInterval;
      jest.spyOn(global, 'clearInterval');
    
      messageController.stopAllMonitoring();
    
      expect(global.clearInterval).toHaveBeenCalledTimes(2);
      expect(global.clearInterval).toHaveBeenCalledWith(mockMonitorInterval);
      expect(global.clearInterval).toHaveBeenCalledWith(mockConnectionCheckInterval);
      expect(messageController.monitorInterval).toBeNull();
      expect(messageController.connectionCheckInterval).toBeNull();
    });
  });

  describe('_setContentType', () => {
    test('should return correct content type', async () => {
      expect(await messageController._setContentType('jpg')).toBe('image/jpg');
      expect(await messageController._setContentType('mp4')).toBe('video/mp4');
      expect(await messageController._setContentType('unknown')).toBe('file/');
    });
  });
});