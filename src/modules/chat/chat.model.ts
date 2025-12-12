import { IChatMessageDoc, IChatMessageModel, IChatParticipantDoc, IChatParticipantModel, IChatRoomDoc, IChatRoomModel } from './chat.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

// ---------- Chat Room Schema ----------
const chatRoomSchema = new mongoose.Schema<IChatRoomDoc, IChatRoomModel>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    type: {
      type: String,
      enum: ['direct', 'group', 'tow-request'],
      required: true,
    },
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }] as any,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    towRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TowRequest',
      required: false,
    },
    lastMessage: {
      type: String,
      required: false,
    },
    lastMessageAt: {
      type: Date,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ---------- Chat Message Schema ----------
const chatMessageSchema = new mongoose.Schema<IChatMessageDoc, IChatMessageModel>(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    } as any,
    senderId: {
      type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and string for system messages
      ref: 'User',
      required: true,
    } as any,
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text',
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      required: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      required: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      required: false,
    },
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    }],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ---------- Chat Participant Schema ----------
const chatParticipantSchema = new mongoose.Schema<IChatParticipantDoc, IChatParticipantModel>(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    } as any,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    } as any,
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      required: false,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastReadAt: {
      type: Date,
      required: false,
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ---------- Indexes ----------
chatRoomSchema.index({ participants: 1, type: 1 });
chatRoomSchema.index({ towRequestId: 1 });
chatRoomSchema.index({ lastMessageAt: -1 });

chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ 'readBy.userId': 1 });

chatParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });
chatParticipantSchema.index({ userId: 1, isActive: 1 });

// ---------- Chat Room Methods ----------
chatRoomSchema.static('isUserParticipant', async function (roomId: string, userId: string): Promise<boolean> {
  const room = await this.findById(roomId);
  if (!room) return false;
  return room.participants.some(participantId => participantId.toString() === userId);
});

chatRoomSchema.static('getUserRooms', async function (userId: string): Promise<IChatRoomDoc[]> {
  return this.find({
    participants: { $in: [new mongoose.Types.ObjectId(userId)] },
    isActive: true,
  })
    .populate('participants', 'firstName lastName email image isOnline')
    .populate('createdBy', 'firstName lastName email image')
    .populate('towRequestId', 'status requesterName')
    .sort({ lastMessageAt: -1 });
});

chatRoomSchema.static('createDirectRoom', async function (user1Id: string, user2Id: string): Promise<IChatRoomDoc> {
  // Check if direct room already exists
  const existingRoom = await this.findOne({
    type: 'direct',
    participants: { $all: [user1Id, user2Id] },
    isActive: true,
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create new direct room
  const room = new this({
    type: 'direct',
    participants: [user1Id, user2Id],
    createdBy: user1Id,
  });

  return room.save();
});

chatRoomSchema.static('createTowRequestRoom', async function (towRequestId: string, participants: string[]): Promise<IChatRoomDoc> {
  // Check if tow request room already exists
  const existingRoom = await this.findOne({
    type: 'tow-request',
    towRequestId,
    isActive: true,
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create new tow request room
  const room = new this({
    type: 'tow-request',
    participants,
    createdBy: participants[0], // First participant is the creator
    towRequestId,
    name: `Tow Request #${towRequestId}`,
  });

  return room.save();
});

// ---------- Chat Message Methods ----------
chatMessageSchema.static('getRoomMessages', async function (roomId: string, page = 1, limit = 50): Promise<IChatMessageDoc[]> {
  const skip = (page - 1) * limit;
  
  return this.find({
    roomId,
    isDeleted: false,
  })
    .populate('senderId', 'firstName lastName email image')
    .populate('replyTo', 'content senderId')
    .populate('replyTo.senderId', 'firstName lastName')
    .populate('readBy.userId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
});

chatMessageSchema.static('markAsRead', async function (messageId: string, userId: string): Promise<void> {
  await this.findByIdAndUpdate(messageId, {
    $addToSet: {
      readBy: {
        userId,
        readAt: new Date(),
      },
    },
  });
});

chatMessageSchema.static('markRoomAsRead', async function (roomId: string, userId: string): Promise<void> {
  // Mark all unread messages in the room as read
  await this.updateMany(
    {
      roomId,
      'readBy.userId': { $ne: userId },
      isDeleted: false,
    },
    {
      $addToSet: {
        readBy: {
          userId,
          readAt: new Date(),
        },
      },
    }
  );
});

chatMessageSchema.static('getUnreadCount', async function (roomId: string, userId: string): Promise<number> {
  return this.countDocuments({
    roomId,
    'readBy.userId': { $ne: userId },
    isDeleted: false,
  });
});

// ---------- Chat Participant Methods ----------
chatParticipantSchema.static('addParticipant', async function (roomId: string, userId: string, role = 'member'): Promise<IChatParticipantDoc> {
  const participant = new this({
    roomId,
    userId: new mongoose.Types.ObjectId(userId),
    role,
  });

  return participant.save();
});

chatParticipantSchema.static('removeParticipant', async function (roomId: string, userId: string): Promise<void> {
  await this.findOneAndUpdate(
    { roomId, userId },
    { isActive: false, leftAt: new Date() }
  );
});

chatParticipantSchema.static('getRoomParticipants', async function (roomId: string): Promise<IChatParticipantDoc[]> {
  return this.find({
    roomId,
    isActive: true,
  })
    .populate('userId', 'firstName lastName email image isOnline lastLogin')
    .sort({ joinedAt: 1 });
});

chatParticipantSchema.static('updateLastRead', async function (roomId: string, userId: string): Promise<void> {
  await this.findOneAndUpdate(
    { roomId, userId },
    { lastReadAt: new Date() }
  );
});

// ---------- Plugins ----------
chatRoomSchema.plugin(toJSON);
chatRoomSchema.plugin(paginate);

chatMessageSchema.plugin(toJSON);
chatMessageSchema.plugin(paginate);

chatParticipantSchema.plugin(toJSON);
chatParticipantSchema.plugin(paginate);

// ---------- Models ----------
const ChatRoom = mongoose.model<IChatRoomDoc, IChatRoomModel>('ChatRoom', chatRoomSchema);
const ChatMessage = mongoose.model<IChatMessageDoc, IChatMessageModel>('ChatMessage', chatMessageSchema);
const ChatParticipant = mongoose.model<IChatParticipantDoc, IChatParticipantModel>('ChatParticipant', chatParticipantSchema);

export default { ChatRoom, ChatMessage, ChatParticipant };
