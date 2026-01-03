import mongoose from 'mongoose';
import {User} from './models/user.models.js';
import {Admin} from './models/admin.model.js';


mongoose.connect(`mongodb+srv://aseelaroor10:v42rBJ4jAB02Ln71@c-zone-prod.owtnu.mongodb.net/C-Zone`, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');

    try {
      // Step 1: Fetch all colleges and map college names to their IDs
      const colleges = await Admin.find({});
      const collegeMap = colleges.reduce((map, college) => {
        map[college.name] = college._id;
        return map;
      }, {});

      // Step 2: Fetch all users and update with collegeId
      const users = await User.find({});
      for (const user of users) {
        const collegeId = collegeMap[user.college];
        if (collegeId) {
          await User.updateOne(
            { _id: user._id },
            { $set: { collegeId } }
          );
          console.log(`------\nUpdated user \n${user._id}:${user.name} with collegeId \n${collegeId}:${user.college}\n--------\n`);
        } else {
          console.warn(`No matching college found for user ${user._id}`);
        }
      }

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Error during migration:', error);
    } finally {
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });
