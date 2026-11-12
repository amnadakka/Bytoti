import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusIdDto, UpdateReviewIdDto } from './dto/update-order.dto';
import { CreateReorderDto } from './dto/create-reorder.dto';
import { CreateUserOrderDto } from './dto/create-userOrder';
import { OrderStatusService } from 'src/order-status/order-status.service';
import { ReviewService } from 'src/review/review.service';
import { CreateReviewDto } from 'src/review/dto/create-review.dto';
import { UpdateReviewDto } from 'src/review/dto/update-review.dto';
import { TelegramBotService } from 'src/telegram-bot/telegram-bot.service';
import { AMINAH_ID, SANA_ID, SHAHED_ID } from 'src/telegram-bot/telegram-constant';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderStatusService: OrderStatusService,
    private readonly reviewService: ReviewService,
    private readonly telegramService: TelegramBotService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,

  ) { }

  @Post()
  async create(@Body() createUserOrderDto: CreateUserOrderDto) {
    const pendingDocs = await this.orderStatusService.findPendingFromChefId();
    for (let i = 0; i < createUserOrderDto.orders.length; i++) {
      let createOrder: CreateOrderDto = {
        userId: '',
        kitchenId: '',
        orderStatusId: '',
        uniqueId: '',
        deliveredDate: undefined,
        location: undefined,
        details: '',
        locationDetails: '',
        regionId: '',
        price: '',
        baskets: []
      }
      let uniqueId = await this.orderService.genUniqueId()
      createOrder.uniqueId = uniqueId
      createOrder.orderStatusId = pendingDocs._id
      createOrder.userId = createUserOrderDto.userId
      createOrder.deliveredDate = createUserOrderDto.deliveredDate
      createOrder.regionId = createUserOrderDto.regionId
      createOrder.locationDetails = createUserOrderDto.locationDetails
      createOrder.location = createUserOrderDto.location
      createOrder.kitchenId = createUserOrderDto.orders[i].kitchenId
      createOrder.price = createUserOrderDto.orders[i].price
      createOrder.baskets = createUserOrderDto.orders[i].baskets
      await this.orderService.create(createOrder)

    }
    this.telegramService.sendMessageToUser(process.env.TELEGRAM_AMINAH_ID,
      `Received a new order from ${createUserOrderDto.locationDetails}, please leave facebook and go to work! 🥪`)
    this.telegramService.sendMessageToUser( process.env.TELEGRAM_SANA_ID, `Received a new order from ${createUserOrderDto.locationDetails}, please check the dashboard! 🥪`)
    this.telegramService.sendMessageToUser( process.env.TELEGRAM_SHAHED_ID, `Received a new order from ${createUserOrderDto.locationDetails}, please check the dashboard! 🥪`)
   
    await this.notificationService.create({
      description: `Received a new order from ${createUserOrderDto.locationDetails}`,
      userId: createUserOrderDto.userId,
      type: 'طلبية معلقة'
    })

    const userDoc = await this.userService.findOne(createUserOrderDto.userId)
    const payload = {
      'notification': {
        'title': `طلبية معلقة`,
        'body': `سيتم الاطلاع على طلبك قريباً`,
      },
      'data': {
        'personSent': "ما بعرف اذا بتلزم"
      }
    };
    this.notificationService.sendSingleNotification(payload, userDoc.fcm)

    return 'done'
  }

  @Patch('cancel/:id')
  async cancel(@Param('id') id: string) {
    const result = await this.orderService.cancel(id)
    if (result) {
      this.telegramService.sendMessageToUser(process.env.TELEGRAM_AMINAH_ID, `an order ${result.uniqueId} is canceled`)
      this.telegramService.sendMessageToUser( process.env.TELEGRAM_SANA_ID, `an order ${result.uniqueId} is canceled`)
      this.telegramService.sendMessageToUser( process.env.TELEGRAM_SHAHED_ID, `an order ${result.uniqueId} is canceled`)
     

      await this.notificationService.create({
        description: `an order is canceled`,
        orderId: result._id,
        uniqueId: result.uniqueId,
        userId: result.userId,
        type: 'طلبية ملغاة'
      })

      await this.notificationService.create({
        description: `لقد قمت بإلغاء طلبك`,
        type: 'طلبية ملغاة',
        orderId: result._id,
        userId: result.userId,
        isDashboard: false
      })

      const userDoc = await this.userService.findOne(result.userId)
      const payload = {
        'notification': {
          'title': `طلبية ملغاة`,
          'body': 'لقد قمت بإلغاء طلبك'
        },
        'data': {
          'personSent': "ما بعرف اذا بتلزم"
        }
      };
       return 'done'
    }
    throw new HttpException(
      {
        message: "call customer service please"
      }
      , HttpStatus.CONFLICT);

  }

  @Patch('receive/:id')
  async receive(@Param('id') id: string) {
    const pendingDocs = await this.orderStatusService.findCancelId()
    const rejectUserDocs = await this.orderStatusService.findRejectedFromUserId()
    const deliveredDocs = await this.orderStatusService.findDeliveredId()
    const orderDocs = await this.orderService.findOne(id) as any
    if ((rejectUserDocs._id).toString() == orderDocs.orderStatusId)
      throw new HttpException('you can`t give review to order you rejected', HttpStatus.CONFLICT)
    if ((pendingDocs._id).toString() == orderDocs.orderStatusId)
      throw new HttpException('you can`t give review to order you have canceled', HttpStatus.CONFLICT)

    let createReviewDto: CreateReviewDto = {
      isDelivered: true
    }
    let updateOrderDto: UpdateOrderStatusIdDto = {
      orderStatusId: deliveredDocs.id
    }
    const reviewDocs = await this.reviewService.create(createReviewDto)
    let updateOrder: UpdateReviewIdDto = {
      reviewId: reviewDocs._id
    }
    await this.orderService.updateOrderReviewId(id, updateOrder)

    this.telegramService.sendMessageToUser(process.env.TELEGRAM_AMINAH_ID, `An order ${orderDocs.uniqueId} is delivered`)
    this.telegramService.sendMessageToUser( process.env.TELEGRAM_SANA_ID, `An order ${orderDocs.uniqueId} is delivered`)
    this.telegramService.sendMessageToUser( process.env.TELEGRAM_SHAHED_ID, `An order ${orderDocs.uniqueId} is delivered`)


    await this.notificationService.create({
      description: `An order ${orderDocs.uniqueId} is delivered`,
      userId: orderDocs.userId,
      orderId: orderDocs._id,
      uniqueId: orderDocs.uniqueId,
      type: "تم التوصيل"
     })
  
    return this.orderService.updateOrderStatusId(id, updateOrderDto);

  }

  @Post('review/:id')
  async review(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    const orderDoc = await this.orderService.findOne(id)
    if (!orderDoc.reviewId) throw new HttpException('receive first', HttpStatus.CONFLICT)
    const reviewDoc = await this.reviewService.findOne(orderDoc.reviewId)
    if (reviewDoc.createdAt) throw new HttpException('you can`t post two review', HttpStatus.CONFLICT)
    await this.reviewService.update(orderDoc.reviewId, updateReviewDto)
    return 'done'
  }

  @Get('user/:id')
  async findUser(@Param('id') id: string) {
    return await this.orderService.findUserHistory(id)
  }

  @Get('dashboard/all')
  async findAllDashboard() {
    return await this.orderService.findAllDashboard();
  }

  @Get('dashboard/:id')
  async findOneDashboard(@Param('id') id: string) {
    return await this.orderService.findOneDashboard(id);
  }

  @Get('dashboard/uniqueId/:id')
  async findOneByUniqueIdDashboard(@Param('id') id: string) {
    return await this.orderService.findOneByUniqueDashboard(id);
  }

  @Patch('dashboard/orderStatus/:id')
  async updateOrderStatus(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderStatusIdDto) {
     return this.orderService.updateOrderStatusId(id, updateOrderDto);
  }

  @Get('sorry')
  async gh(){
    const payload = {
      'notification': {
        'title': `طلبية السمبوسك بفروج تُطلب قبل يوم 😥`,
        'body': ` للأسف طلبك الساعة 12:20 مساءا لم يكن متاحا للتلبية الفورية كما هو مذكور في تفاصيل الوجبة`,
      },
      'data': {
        'personSent': "ما بعرف اذا بتلزم"
      }
    };
    this.notificationService.sendSingleNotification(payload, "clvvl6DUTImXCw05WujZ86:APA91bFkuTB6Fc3D2yYGSYcHHCqp-0-95ho53K5HkYYH5pOvfpcCGq6NOvfXrUs0oU2_AZeZjTcgRh3vQU-XDvjziLanDeWRokvqLa8G0eOUD1ACTyel51fsOJps0Ssq2vP8VYl_hdH6")

  }


@Get('present')
async ghs(){
  const payload = {
    'notification': {
      'title': `the best english trainer ever 💙`,
      'body': `  💥 بيتوتي يقدم للدكتور غيث وجبة خاصة.. عامل التوصيل في طريقه إليك`,
    },
    'data': {
      'personSent': "ما بعرف اذا بتلزم"
    }
  };
  this.notificationService.sendSingleNotification(payload, "cY4HI5SnRxKsM6SZBYDc9-:APA91bG2iduyWSOQgLOVEPJ6x6CDgPqwUY78RHdSFStcqCn9NNIr9W5vyokquwhyCm5LFFSxIQvfqQZBG9KN1SBCRTUjR3d44WgIRMFUbj_oJCRcSylKwdlA8D7PK5ZTC0-WvKoR756H")

}
 

}


@Controller('reorder')
export class ReorderController {
  constructor(
    private readonly orderService: OrderService) { }

  @Post()
  async reorder(@Body() createReOrderDto: CreateReorderDto) {
    const order = await this.orderService.reorder(createReOrderDto)
    return {
      id: order._id,
      price: order.price
    }
  }

  @Patch(':id/:status')
  async update(@Param('id') id: string, @Param('status') status: boolean) {
    await this.orderService.updateReorderStatus(id, status)
  }

}
