const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { Service } = require('../schemas/service');
const { Employee } = require('../schemas/employee');
const { Booking, validateBookingEntry } = require('../schemas/booking');
const { requestLogger } = require('../logger');
const validateObjectId = require('../middlewares/validateObjectId');
const { generateId } = require('../utils');


// get all bookings
router.get('/', async (req, res) => {

  try {
    let limit = 10;
    let page = 0;
    let order = 1;
    let sort = 'dateTime';
    let sortObj = {};

    if (req.query.limit && parseInt(req.query.limit) > 0)
      limit = parseInt(req.query.limit);

    if (req.query.page && parseInt(req.query.page) > 0)
      page = parseInt(req.query.page) - 1;

    if (req.query.order && (req.query.order === '-1' || req.query.order === '1'))
      order = parseInt(req.query.order);

    if (req.query.sort && req.query.sort !== '')
      sort = req.query.sort;

    sortObj[sort] = order;

    const bookings = await Booking.find(
      {},
      null,
      {
        skip: page * limit,
        limit
      }
    ).sort(sortObj);

    requestLogger(`[GET] ${req.baseUrl} - 200`);
    res.status(200).send(bookings);
  }
  catch (error) {
    requestLogger(`[GET] ${req.baseUrl} - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// create new booking
router.post('/', async (req, res) => {
  try {

    const bookingId = generateId('b');
    const requestBody = {
      ...(req.body),
      bookingId
    };

    const { error } = validateBookingEntry(requestBody);

    if (error) {
      requestLogger(`[POST] ${req.baseUrl}/ - 400`);
      return res.status(400).send(JSON.stringify({'message' : error.details[0].message}));
    }

    if (!mongoose.Types.ObjectId.isValid(requestBody.receptionistId)) {
      requestLogger(`[POST] ${req.baseUrl}/ - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Invalid receptionistId'}));
    }

    const employee = await Employee.findById(requestBody.receptionistId);
    if (!employee) {
      requestLogger(`[POST] ${req.baseUrl} - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Employee Not Found!'}));
    }

    if (!mongoose.Types.ObjectId.isValid(requestBody.serviceId)) {
      requestLogger(`[POST] ${req.baseUrl}/ - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Invalid serviceId'}));
    }

    const service = await Service.findById(requestBody.serviceId);
    if (!service) {
      requestLogger(`[POST] ${req.baseUrl} - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Service Not Found!'}));
    }


    let booking = new Booking({
      bookingId: bookingId,
      receptionistId: req.body.receptionistId,
      receptionistName: req.body.receptionistName,
      serviceName: req.body.serviceName,
      serviceId: req.body.serviceId,
      assignedStaffName: req.body.assignedStaffName,
      patientName: req.body.patientName,
      patientId: req.body.patientId,
      bookingDate: req.body.bookingDate,
      bookingTime: req.body.bookingTime,
      status: req.body.status,
      remarks: req.body.remarks
    });

    booking = await booking.save();

    return res.status(201).send(booking);
  }
  catch (error) {
    console.error(error);
    requestLogger(`[GET] ${req.baseUrl} - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// search booking by patient name (or) servie name
router.get('/search', async (req, res) => {
  try {
    let filters = [];
    let bookings = [];

    if (req.query.service && req.query.servie !== '')
      filters.push({'serviceName' :  { $regex: req.query.service, $options: 'i'} });

    if (req.query.patient && req.query.patient !== '')
      filters.push({'patientName' : { $regex: req.query.patient, $options: 'i'} });

    if (filters.length !== 0) {
      bookings = await Booking.find({
        $and : [ ...filters ]
      });
    }

    requestLogger(`[GET] ${req.baseUrl}/search - 200`);
    res.status(200).send(bookings);
  }
  catch (error) {
    requestLogger(`[GET] ${req.baseUrl}/search - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// get total number of bookings
router.get('/count', async (req, res) => {
  try {
    const count = await Booking.count();

    requestLogger(`[GET] ${req.baseUrl}/count - 200`);
    res.status(200).send(JSON.stringify({'count' : count}));
  }
  catch (error) {
    console.error(error);
    requestLogger(`[GET] ${req.baseUrl}/count - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// get booking by id
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      requestLogger(`[GET] ${req.baseUrl}/${req.params.id} - 404`);
      return res.status(404).send(JSON.stringify({'message' : 'Booking Not Found!'}));
    }

    requestLogger(`[GET] ${req.baseUrl}/${req.params.id} - 200`);
    return res.status(200).send(booking);
  }
  catch (error) {
    requestLogger(`[GET] ${req.baseUrl}/${req.params.id} - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// edit/update booking by id
router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated: new Date()},
      { new: true}
    );

    if (!booking) {
      requestLogger(`[PUT] ${req.baseUrl}/${req.params.id} - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Booking Update Failed'}));
    }

    requestLogger(`[PUT] ${req.baseUrl}/${req.params.id} - 201`);
    return res.status(201).send(booking);
  }
  catch (error) {
    requestLogger(`[PUT] ${req.baseUrl}/${req.params.id} - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});


// delete booking by id
router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndRemove(req.params.id);

    if (!booking) {
      requestLogger(`[DELETE] ${req.baseUrl}/${req.params.id} - 400`);
      return res.status(400).send(JSON.stringify({'message' : 'Deletion Failed'}));
    }

    requestLogger(`[DELETE] ${req.baseUrl}/${req.params.id} - 201`);
    return res.status(201).send('');
  }
  catch (error) {
    console.error(error);
    requestLogger(`[DELETE] ${req.baseUrl}/${req.params.id} - 500`);
    res.status(500).send(JSON.stringify({'message' : 'Internal Server Error!'}));
  }
});



module.exports = router;
