export class UserService {
  async findByUsername(username: string) {
    void username;
    return null;
  }

  async createUser() {
    return {
      message: "User creation service scaffolded. Add DB repository next.",
    };
  }
}

export const userService = new UserService();
