// Migration script to fix reading history index - handles all edge cases
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anlix';

async function migrate() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db();
    const collection = db.collection('readinghistories');
    
    // Step 1: List current indexes
    console.log('=== Current indexes ===');
    const indexes = await collection.indexes();
    for (const idx of indexes) {
      console.log(`- ${idx.name}:`, JSON.stringify(idx.key));
    }
    
    // Step 2: Drop ALL indexes except _id
    console.log('\n=== Dropping all custom indexes ===');
    try {
      await collection.dropIndexes();
      console.log('All custom indexes dropped!');
    } catch (err) {
      console.log('Error dropping indexes:', err.message);
    }
    
    // Step 3: Check for documents with missing contentSlug and fix them
    console.log('\n=== Checking for documents with null contentSlug ===');
    const badDocs = await collection.find({
      $or: [
        { contentSlug: null },
        { contentSlug: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`Found ${badDocs.length} documents with missing contentSlug`);
    
    for (const doc of badDocs) {
      console.log(`  - Fixing doc ${doc._id}: novelSlug=${doc.novelSlug}, contentTitle=${doc.contentTitle}`);
      
      // Use novelSlug as contentSlug if available
      const contentSlug = doc.novelSlug || doc.contentTitle?.toLowerCase().replace(/\s+/g, '-') || `unknown-${doc._id}`;
      
      await collection.updateOne(
        { _id: doc._id },
        { 
          $set: { 
            contentSlug: contentSlug,
            contentType: doc.contentType || 'novel'
          }
        }
      );
    }
    
    if (badDocs.length > 0) {
      console.log('Fixed all documents with missing contentSlug');
    }
    
    // Step 4: Create correct indexes
    console.log('\n=== Creating correct indexes ===');
    
    await collection.createIndex(
      { userId: 1, contentSlug: 1, contentType: 1 },
      { unique: true, name: 'userId_contentSlug_contentType' }
    );
    console.log('Created: userId_contentSlug_contentType (unique)');
    
    await collection.createIndex(
      { userId: 1, readAt: -1 },
      { name: 'userId_readAt' }
    );
    console.log('Created: userId_readAt');
    
    // Step 5: Verify
    console.log('\n=== Final indexes ===');
    const finalIndexes = await collection.indexes();
    for (const idx of finalIndexes) {
      console.log(`- ${idx.name}:`, JSON.stringify(idx.key));
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

migrate();
