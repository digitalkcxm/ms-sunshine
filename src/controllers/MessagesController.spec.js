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

describe('MessageController', () => {
  let messageController;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {};
    messageController = new MessageController(mockDatabase);
    
    global.amqpConn = {
      sendToQueue: jest.fn(),
      assertQueue: jest.fn(),
      prefetch: jest.fn(),
      consume: jest.fn(),
      checkQueue: jest.fn()
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

  describe('_setContentType', () => {
    test('should return correct content type', async () => {
      expect(await messageController._setContentType('jpg')).toBe('image/jpg');
      expect(await messageController._setContentType('mp4')).toBe('video/mp4');
      expect(await messageController._setContentType('unknown')).toBe('file/');
    });
  });
});