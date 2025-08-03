defmodule HeldcoreWeb.PageController do
  use HeldcoreWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
