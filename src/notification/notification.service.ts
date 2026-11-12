import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { UpdateNotificationDto } from "./dto/update-notification.dto";
import {
  NotificationDocument,
  Notification,
} from "./schemas/notification.schema";
import { Model, Types } from "mongoose";
import * as firebaseAdmin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private fcmAdmin: firebaseAdmin.app.App | null = null;

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      this.logger.warn(
        "GOOGLE_APPLICATION_CREDENTIALS is not set — FCM push is disabled",
      );
      return;
    }

    const resolved = path.resolve(credentialsPath);
    if (!fs.existsSync(resolved)) {
      this.logger.warn(
        `Firebase credentials file not found at ${resolved} — FCM push is disabled`,
      );
      return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));
    this.fcmAdmin = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
  }

  sendSingleNotification(payload: any, fcmToken: string) {
    if (!this.fcmAdmin) {
      this.logger.warn("Skipping FCM send — Firebase Admin is not initialized");
      return;
    }
    if (!fcmToken) {
      this.logger.warn("Skipping FCM send — missing device token");
      return;
    }

    this.fcmAdmin
      .messaging()
      .sendToDevice(fcmToken, payload, { priority: "high" })
      .then(async (result) => {
        this.logger.debug(result);
        if (result.results?.[0]?.error) {
          this.logger.warn(result.results[0].error);
        }
      })
      .catch((error) => this.logger.error("Error sending FCM message", error));
  }

  async create(createNotificationDto: CreateNotificationDto) {
    const createNotification = new this.notificationModel(
      createNotificationDto,
    );
    await createNotification.save();
    return "done";
  }

  async findALlForDashboard() {
    return this.notificationModel
      .find({ isDashboard: true }, { isDashboard: 0, user: 0 })
      .sort({ createdAt: -1 });
  }

  async findForUser(userId: string) {
    return await this.notificationModel
      .find({ userId, isDashboard: false }, { isDashboard: 0, user: 0 })
      .sort({ createdAt: -1 });
  }
}
