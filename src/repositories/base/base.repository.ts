import { injectable } from "inversify";
import mongoose, { Model, Document, FilterQuery } from "mongoose";

@injectable()
export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const document = await this.model.create(data);
      return document as T; // Ensure the return type matches T
    } catch (error) {
      throw new Error(`Failed to create document: ${(error as Error).message}`);
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      const document = await this.model.findById(id).select("-password").lean().exec();
      return document as T | null; // Cast to T | null
    } catch (error) {
      throw new Error(`Failed to find document by ID: ${(error as Error).message}`);
    }
  }

  async find(query: FilterQuery<T>): Promise<T[]> {
    try {
      const documents = await this.model.find(query).select("-password").lean().exec();
      return documents as T[]; // Cast to T[]
    } catch (error) {
      throw new Error(`Failed to find documents: ${(error as Error).message}`);
    }
  }

  async findOne(query: FilterQuery<T>): Promise<T | null> {
    try {
      const document = await this.model.findOne(query).select("-password").lean().exec();
      return document as T | null; // Cast to T | null
    } catch (error) {
      throw new Error(`Failed to find document: ${(error as Error).message}`);
    }
  }

  async updateById(id: string, data: Partial<T>): Promise<T | null> {
    try {
      const document = await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean().exec();
      return document as T | null; // Cast to T | null
    } catch (error) {
      throw new Error(`Failed to update document: ${(error as Error).message}`);
    }
  }

  async updateOne(query: FilterQuery<T>, update: Partial<T>): Promise<T | null> {
    try {
      const document = await this.model.findOneAndUpdate(query, update, { new: true, runValidators: true }).lean().exec();
      return document as T | null; // Cast to T | null
    } catch (error) {
      throw new Error(`Failed to update document: ${(error as Error).message}`);
    }
  }

  async deleteById(id: string): Promise<boolean> {
    try {
      const result = await this.model.deleteOne({ _id: id });
      return result.deletedCount === 1;
    } catch (error) {
      throw new Error(`Failed to delete document: ${(error as Error).message}`);
    }
  }
}