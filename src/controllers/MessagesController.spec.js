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
jest.mock('../config/rabbitMQ.js', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(),
  closeConnection: jest.fn().mockResolvedValue(),
}));

describe('MessageController', () => {
  let messageController;
  let mockDatabase;

  beforeEach(() => {
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
      nack: jest.fn()
    };

    if (messageController.msCompanyService && messageController.msCompanyService.getByID) {
      jest.spyOn(messageController.msCompanyService, 'getByID').mockResolvedValue({ data: { id: 'mockCompanyId' } });
    }
  });

  afterEach(() => {
    messageController.stopMonitoring();
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
      expect(messageController.retryCount.get('testMsgId')).toBeUndefined();
    });

    test('should retry message processing up to 3 times', async () => {
      const mockContent = { id: 'testId', message: 'Test message' };
      const mockMsg = { properties: { messageId: 'testMsgId' }, content: Buffer.from(JSON.stringify(mockContent)) };

      messageController.processMessage = jest.fn().mockRejectedValue(new Error('Test error'));

      await messageController.processMessageWithRetry(mockContent, mockMsg);
      await messageController.processMessageWithRetry(mockContent, mockMsg);
      await messageController.processMessageWithRetry(mockContent, mockMsg);

      expect(messageController.processMessage).toHaveBeenCalledTimes(3);
      expect(global.amqpConn.sendToQueue).toHaveBeenCalledTimes(2);
      expect(global.amqpConn.nack).toHaveBeenCalledTimes(1);
      expect(messageController.retryCount.get('testMsgId')).toBeUndefined();
    });
  });

  describe('handleMessageError', () => {
    test('should handle recoverable error', () => {
      const mockError = new Error('Recoverable error');
      const mockMsg = { content: Buffer.from('Test message') };

      messageController.isRecoverableError = jest.fn().mockReturnValue(true);

      messageController.handleMessageError(mockError, mockMsg);

      expect(global.amqpConn.sendToQueue).toHaveBeenCalledWith('mssunshine_input_retry', mockMsg.content);
      expect(global.amqpConn.ack).toHaveBeenCalledWith(mockMsg);
    });

    test('should handle non-recoverable error', () => {
      const mockError = new Error('Non-recoverable error');
      const mockMsg = { content: Buffer.from('Test message') };

      messageController.isRecoverableError = jest.fn().mockReturnValue(false);

      messageController.handleMessageError(mockError, mockMsg);

      expect(global.amqpConn.nack).toHaveBeenCalledWith(mockMsg, false, false);
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