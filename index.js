const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { count } = require("node:console");

const app = express();
const port = 5000;

require("dotenv").config();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World from milestone 10!");
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect MongoDB
    await client.connect();

    console.log("MongoDB connected successfully");

    const database = client.db("hireloop_db");

    const jobCollection = database.collection("jobs");
    const companyCollection = database.collection("companies");
    const usersCollection = database.collection("user");
    const applicationsCollection = database.collection("applications");
    const plansCollection = database.collection("plans");
    const subscriptionsCollection = database.collection("subscriptions");

    // Test MongoDB connection
    await client.db("admin").command({ ping: 1 });

    console.log("Pinged your deployment. You connected to MongoDB!");

    // get users
    app.get("/api/users", async (req, res) => {
      const cursor = usersCollection.find().skip(10);
      const result = await cursor.toArray();
      res.send(result);
    });

    // ========================================
    // GET JOBS
    // ========================================

    app.get("/api/jobs", async (req, res) => {
      try {
        const query = {};

        if (req.query.companyId) {
          query.companyId = req.query.companyId;
        }

        if (req.query.status) {
          query.status = req.query.status;
        }

        const result = await jobCollection.find(query).toArray();

        res.status(200).json(result);
      } catch (error) {
        console.error("Get jobs error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to get jobs",
          error: error.message,
        });
      }
    });

    app.get("/api/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // ========================================
    // POST JOB
    // ========================================

    app.post("/api/jobs", async (req, res) => {
      try {
        const job = req.body;
        const newJob = {
          ...job,
          createdAt: new Date(),
        };

        console.log("Received job:", newJob);

        const result = await jobCollection.insertOne(newJob);

        res.status(201).json({
          success: true,
          message: "Job created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Job creation error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to create job",
          error: error.message,
        });
      }
    });

    // Application related api
    app.get("/api/applications", async (req, res) => {
      try {
        const query = {};
        if (req.query.applicantId) {
          query.applicantId = req.query.applicantId;
        } else if (req.query.email) {
          query.applicantEmail = req.query.email;
        }

        const result = await applicationsCollection.find(query).toArray();
        res.status(200).json(result);
      } catch (error) {
        console.error("Get applications error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post("/api/applications", async (req, res) => {
      try {
        const application = req.body;
        const newApplication = {
          ...application,
          createdAt: new Date(),
        };

        const result = await applicationsCollection.insertOne(newApplication);

        res.status(201).json({
          success: true,
          message: "Application submitted successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Application submission error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to submit application",
          error: error.message,
        });
      }
    });

    // ========================================
    // PLANS API
    // ========================================
    app.get("/api/plans", async (req, res) => {
      try {
        const query = {};
        if (req.query.plan_id) {
          query.id = req.query.plan_id;
        }
        const plan = await plansCollection.findOne(query);
        res.send(plan);
      } catch (error) {
        console.error("Get plan error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    //Subscriptions
    app.post("/api/subscriptions", async (req, res) => {
      const data = req.body;
      const subsInfo = {
        ...data,
        createdAt: new Date(),
      };
      const result = await subscriptionsCollection.insertOne(subsInfo);

      //update the user plan information
      const filter = { email: data.email };
      // update the value
      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await usersCollection.updateOne(
        filter,
        updateDocument,
      );
      res.send(updateResult);
    });

    // ========================================
    // POST COMPANY & OTHERS
    // ========================================

    // app.get("/api/companies", async (req, res) => {
    //   const cursor = companyCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // inefficient way to join/aggregate collection
    app.get("/api/companies", async (req, res) => {
      const cursor = companyCollection.find();
      const companies = await cursor.toArray();

      for (const company of companies) {
        const filter = {
          companyId: company._id.toString(),
        };
        const jobCount = await jobCollection.countDocuments(filter);
        company.jobCount = jobCount;
      }

      res.send(companies);
    });
    // inefficient way to join/aggregate collection
    app.get("/api/companies2", async (req, res) => {
      const pipeline = [
        {
          $skip: 5,
        },
        {
          $limit: 2,
        },
      ];
      const cursor = companyCollection.aggregate(pipeline);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/stats", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$jobType",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
           jobType:"$_id",
           _id:0,
           count:1
          },
        },
        {
          $sort: {
            count: 1,
          },
        },
      ];
      const cursor = jobCollection.aggregate(pipeline);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/my/companies", async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }
      const result = await companyCollection.findOne(query);
      console.log("my companies", result);
      res.send(result || {});
    });

    app.post("/api/companies", async (req, res) => {
      try {
        const company = req.body;
        const newCompany = {
          ...company,
          createdAt: new Date(),
        };

        console.log("Received company:", newCompany);

        const result = await companyCollection.insertOne(newCompany);

        res.status(201).json({
          success: true,
          message: "Company created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Company creation error:", error);

        res.status(500).json({
          success: false,
          message: "Failed to create company",
          error: error.message,
        });
      }
    });

    app.patch("/api/companies/:id", async (req, res) => {
      const id = req.params.id;
      const updatedCompany = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDocs = {
        $set: {
          status: updatedCompany.status,
        },
      };
      const result = await companyCollection.updateOne(filter, updatedDocs);
      res.send(result);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
